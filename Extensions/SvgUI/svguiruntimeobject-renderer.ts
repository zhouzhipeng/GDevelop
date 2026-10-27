namespace gdjs {
  let nextSvgUIInstanceId = 0;
  const svgNamespace = 'http://www.w3.org/2000/svg';
  // Deliberately exclude executable elements, foreignObject, external images,
  // embedded stylesheets and animation. Local paint servers are supported.
  const svgElements = new Set(
    'svg g defs symbol use path rect circle ellipse line polyline polygon text tspan title desc clipPath mask linearGradient radialGradient stop pattern'.split(
      ' '
    )
  );
  const svgAttributes = new Set(
    'id x y x1 y1 x2 y2 cx cy r rx ry width height d points viewBox preserveAspectRatio transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset opacity clip-path clip-rule mask offset stop-color stop-opacity gradientUnits gradientTransform spreadMethod patternUnits patternContentUnits patternTransform font-family font-size font-weight font-style text-anchor dominant-baseline letter-spacing dx dy visibility display href'.split(
      ' '
    )
  );
  const svgStyleProperties = new Set(
    'fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin opacity font-family font-size font-weight font-style text-anchor dominant-baseline letter-spacing stop-color stop-opacity stroke-dasharray stroke-dashoffset visibility display'.split(
      ' '
    )
  );
  const safeSvgValue = (value: string) => {
    // CSS escapes/comments could obscure a URL or other active content.
    if (/[\\<>]|\/\*|@|expression\s*\(/i.test(value)) return false;
    return !/url\s*\(/i.test(value.replace(/url\(\s*#[\w.-]+\s*\)/gi, ''));
  };

  /** Parse into a fresh tree, keeping only supported SVG content. */
  export function sanitizeSvgUI(source: string): SVGSVGElement {
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = parsed.documentElement;
    if (
      parsed.getElementsByTagName('parsererror').length ||
      root.localName !== 'svg' ||
      root.namespaceURI !== svgNamespace
    )
      throw new Error('Invalid SVG document.');
    const copy = (element: Element): Element => {
      const result = document.createElementNS(svgNamespace, element.localName);
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.localName;
        if (name === 'style') {
          const style = (result as SVGElement).style;
          for (const declaration of attribute.value.split(';')) {
            const colon = declaration.indexOf(':');
            if (colon < 0) continue;
            const property = declaration.slice(0, colon).trim().toLowerCase();
            const value = declaration.slice(colon + 1).trim();
            if (svgStyleProperties.has(property) && safeSvgValue(value))
              style.setProperty(property, value);
          }
        } else if (svgAttributes.has(name) && safeSvgValue(attribute.value)) {
          if (name === 'href' && !/^#[\w.-]+$/.test(attribute.value)) continue;
          result.setAttribute(name, attribute.value);
        }
      }
      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === 3)
          result.appendChild(document.createTextNode(child.textContent || ''));
        else if (
          child.nodeType === 1 &&
          (child as Element).namespaceURI === svgNamespace &&
          svgElements.has((child as Element).localName)
        )
          result.appendChild(copy(child as Element));
      }
      return result;
    };
    return copy(root) as SVGSVGElement;
  }

  export class SvgUIRuntimeObjectRenderer {
    private _host = document.createElement('div');
    private _idPrefix = 'gd-svg-' + nextSvgUIInstanceId++ + '-';
    private _svg: SVGSVGElement | null = null;
    private _request: XMLHttpRequest | null = null;
    private _destroyed = false;
    private _paused = false;
    private _error = false;
    private _nodes = new Map<string, SVGElement>();
    private _changes = new Map<string, Map<string, string>>();
    constructor(
      private _object: SvgUIRuntimeObject,
      private _container: RuntimeInstanceContainer
    ) {
      Object.assign(this._host.style, {
        position: 'absolute',
        transformOrigin: '0 0',
        pointerEvents: 'auto',
        overflow: 'hidden',
        display: 'none',
      });
      // Keep pointer input from reaching the canvas through the overlay container.
      for (const type of [
        'pointerdown',
        'pointerup',
        'touchstart',
        'touchend',
        'mousedown',
        'mouseup',
      ])
        this._host.addEventListener(type, (event) => event.stopPropagation());
      this._host.addEventListener('click', (event) => {
        event.stopPropagation();
        if (this._paused || this._object.isHidden()) return;
        const ids: string[] = [];
        let target = event.target as Element | null;
        while (target && target !== this._host) {
          const id = target.getAttribute('data-gdevelop-svg-id');
          if (id) ids.push(id);
          target = target.parentElement;
        }
        this._object.onNodeClicked(ids);
      });
      this._container
        .getGame()
        .getRenderer()
        .getDomElementContainer()
        ?.appendChild(this._host);
    }
    loadResource(name: string) {
      if (this._request) this._request.abort();
      this._request = null;
      this._host.textContent = '';
      this._svg = null;
      this._nodes.clear();
      this._changes.clear();
      this._error = false;
      const loader = this._container.getGame().getResourceLoader();
      const resource = loader.getResource(name);
      if (!resource || resource.kind !== 'image') {
        this._error = true;
        return;
      }
      const request = (this._request = new XMLHttpRequest());
      request.open('GET', loader.getFullUrl(resource.file));
      request.timeout = 30000;
      request.withCredentials = loader.checkIfCredentialsRequired(
        resource.file
      );
      request.onload = () => {
        if (this._destroyed || this._request !== request) return;
        this._request = null;
        try {
          if (
            request.status !== 0 &&
            (request.status < 200 || request.status >= 300)
          )
            throw new Error('SVG request failed.');
          this._svg = sanitizeSvgUI(request.responseText);
          // Namespace IDs so paint references and <use> never resolve to another instance.
          const prefix = this._idPrefix;
          const elements = [
            this._svg as SVGElement,
            ...(Array.from(this._svg.querySelectorAll('*')) as SVGElement[]),
          ];
          for (const element of elements) {
            if (element.id) {
              const id = element.id;
              this._nodes.set(id, element);
              element.setAttribute('data-gdevelop-svg-id', id);
              element.id = prefix + id;
            }
          }
          for (const element of elements) {
            for (const attribute of Array.from(element.attributes)) {
              if (
                attribute.name === 'id' ||
                attribute.name === 'data-gdevelop-svg-id'
              )
                continue;
              let value = attribute.value.replace(
                /url\(\s*#([\w.-]+)\s*\)/gi,
                (_, id) => 'url(#' + prefix + id + ')'
              );
              if (attribute.name === 'href')
                value = '#' + prefix + value.slice(1);
              element.setAttribute(attribute.name, value);
            }
          }
          if (!this._svg.hasAttribute('viewBox')) {
            const width =
              parseFloat(this._svg.getAttribute('width') || '') ||
              this._object.getWidth();
            const height =
              parseFloat(this._svg.getAttribute('height') || '') ||
              this._object.getHeight();
            this._svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
          }
          this._svg.setAttribute('width', '100%');
          this._svg.setAttribute('height', '100%');
          this._host.appendChild(this._svg);
          for (const [id, changes] of this._changes)
            for (const [property, value] of changes)
              this._apply(id, property, value);
        } catch (_) {
          this._svg = null;
          this._error = true;
        }
      };
      request.onerror = () => {
        if (this._request === request) {
          this._request = null;
          this._error = true;
        }
      };
      request.ontimeout = request.onerror;
      request.send();
    }
    isLoaded() {
      return this._svg !== null;
    }
    hasLoadError() {
      return this._error;
    }
    private _apply(id: string, property: string, value: string) {
      const node = this._nodes.get(id);
      if (!node) return;
      if (property === 'text') {
        if (node.localName === 'text' || node.localName === 'tspan')
          node.textContent = value;
      } else if (property === 'fill' || property === 'display')
        node.style.setProperty(property, value);
      else node.setAttribute(property, value);
    }
    private _set(id: string, property: string, value: string) {
      let changes = this._changes.get(id);
      if (!changes) {
        changes = new Map<string, string>();
        this._changes.set(id, changes);
      }
      changes.set(property, value);
      this._apply(id, property, value);
    }
    setNodeText(id: string, text: string) {
      this._set(id, 'text', text);
    }
    setNodeColor(id: string, color: string) {
      const rgb = gdjs.rgbOrHexToRGBColor(color);
      this._set(id, 'fill', `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`);
    }
    setNodeVisible(id: string, visible: boolean) {
      this._set(id, 'display', visible ? 'inline' : 'none');
    }
    setNodeWidth(id: string, width: number) {
      if (isFinite(width)) this._set(id, 'width', String(Math.max(0, width)));
    }
    setPaused(paused: boolean) {
      this._paused = paused;
      this._host.style.display = 'none';
    }
    updatePreRender() {
      const object = this._object;
      this._host.style.display = 'none';
      if (this._paused || this._destroyed || !this._svg) return;
      let container = this._container;
      let ancestor: RuntimeObject = object;
      while (true) {
        if (
          !ancestor.isVisible() ||
          !container.getLayer(ancestor.getLayer()).isVisible()
        )
          return;
        if (!(container instanceof gdjs.CustomRuntimeObjectInstanceContainer))
          break;
        ancestor = container.getOwner();
        container = ancestor.getInstanceContainer();
      }
      const renderer = this._container.getGame().getRenderer();
      const layer = this._container.getLayer(object.getLayer());
      const convert = (x: number, y: number) => {
        const point = layer.convertInverseCoords(x, y, 0, [0, 0]);
        renderer.convertCanvasToDomElementContainerCoords(point, point);
        return point;
      };
      const angle = (object.getAngle() * Math.PI) / 180;
      const left =
        object.getX() +
        object.getWidth() / 2 -
        (Math.cos(angle) * object.getWidth()) / 2 +
        (Math.sin(angle) * object.getHeight()) / 2;
      const top =
        object.getY() +
        object.getHeight() / 2 -
        (Math.sin(angle) * object.getWidth()) / 2 -
        (Math.cos(angle) * object.getHeight()) / 2;
      const origin = convert(left, top);
      const x = convert(left + Math.cos(angle), top + Math.sin(angle));
      const y = convert(left - Math.sin(angle), top + Math.cos(angle));
      const style = this._host.style;
      style.left = '0';
      style.top = '0';
      style.width = object.getWidth() + 'px';
      style.height = object.getHeight() + 'px';
      style.transform = `matrix(${x[0] - origin[0]},${x[1] - origin[1]},${y[0] - origin[0]},${y[1] - origin[1]},${origin[0]},${origin[1]})`;
      style.opacity = String(object.getOpacity() / 255);
      style.zIndex = String(Math.max(0, Math.floor(object.getZOrder())));
      style.display = 'block';
    }
    onDestroy() {
      this._destroyed = true;
      if (this._request) this._request.abort();
      this._request = null;
      this._host.remove();
      this._nodes.clear();
      this._changes.clear();
      this._svg = null;
    }
  }
}
