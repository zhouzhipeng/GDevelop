namespace gdjs {
  export interface SvgUIObjectData extends ObjectData {
    content: { svgResourceName: string; width: number; height: number };
  }

  /** Native SVG overlay. Node IDs are local to each object instance. */
  export class SvgUIRuntimeObject extends gdjs.RuntimeObject {
    private _width: number;
    private _height: number;
    private _opacity = 255;
    private _clicked = new Set<string>();
    private _renderer: SvgUIRuntimeObjectRenderer;

    constructor(
      container: RuntimeInstanceContainer,
      data: SvgUIObjectData,
      instanceData?: InstanceData
    ) {
      super(container, data, instanceData);
      this._width = data.content.width || 320;
      this._height = data.content.height || 180;
      this._renderer = new gdjs.SvgUIRuntimeObjectRenderer(this, container);
      this._renderer.loadResource(data.content.svgResourceName);
      this.onCreated();
    }
    getRendererObject() {
      return null;
    }
    getWidth() {
      return this._width;
    }
    getHeight() {
      return this._height;
    }
    setWidth(value: number) {
      this._width = Math.max(0, value);
    }
    setHeight(value: number) {
      this._height = Math.max(0, value);
    }
    setSize(width: number, height: number) {
      this.setWidth(width);
      this.setHeight(height);
    }
    getOpacity() {
      return this._opacity;
    }
    setOpacity(value: number) {
      this._opacity = Math.max(0, Math.min(255, value));
    }
    extraInitializationFromInitialInstance(data: InstanceData) {
      if (data.customSize) this.setSize(data.width, data.height);
      this.setOpacity(data.opacity === undefined ? 255 : data.opacity);
    }
    updateFromObjectData(oldData: SvgUIObjectData, data: SvgUIObjectData) {
      if (oldData.content.svgResourceName !== data.content.svgResourceName)
        this._renderer.loadResource(data.content.svgResourceName);
      if (oldData.content.width !== data.content.width)
        this.setWidth(data.content.width);
      if (oldData.content.height !== data.content.height)
        this.setHeight(data.content.height);
      return true;
    }
    /** Clicks remain observable by every condition for one event frame. */
    updatePreRender() {
      this._clicked.clear();
      this._renderer.updatePreRender();
    }
    onNodeClicked(ids: string[]) {
      ids.forEach((id) => this._clicked.add(id));
    }
    isNodeClicked(id: string) {
      return this._clicked.has(id);
    }
    isLoaded() {
      return this._renderer.isLoaded();
    }
    hasLoadError() {
      return this._renderer.hasLoadError();
    }
    setNodeText(id: string, text: string) {
      this._renderer.setNodeText(id, text);
    }
    setNodeColor(id: string, color: string) {
      this._renderer.setNodeColor(id, color);
    }
    setNodeVisible(id: string, visible: boolean) {
      this._renderer.setNodeVisible(id, visible);
    }
    setNodeWidth(id: string, width: number) {
      this._renderer.setNodeWidth(id, width);
    }
    onScenePaused() {
      this._clicked.clear();
      this._renderer.setPaused(true);
    }
    onSceneResumed() {
      this._renderer.setPaused(false);
    }
    onDestroyed() {
      super.onDestroyed();
      this._renderer.onDestroy();
    }
  }
  gdjs.registerObject('SvgUI::SvgUIObject', gdjs.SvgUIRuntimeObject);
}
