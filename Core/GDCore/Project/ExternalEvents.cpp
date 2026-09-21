#include "GDCore/Project/ExternalEvents.h"

#include <stdexcept>

#include "ExternalEvents.h"
#include "GDCore/Events/Event.h"
#include "GDCore/Events/Serialization.h"
#include "GDCore/Serialization/SerializerElement.h"

namespace gd {

ExternalEvents::ExternalEvents() {
  // ctor
}

ExternalEvents::ExternalEvents(const ExternalEvents& externalEvents) {
  Init(externalEvents);
}

ExternalEvents& ExternalEvents::operator=(const ExternalEvents& rhs) {
  if (this != &rhs) Init(rhs);

  return *this;
}

void ExternalEvents::Init(const ExternalEvents& externalEvents) {
  name = externalEvents.GetName();
  associatedScene = externalEvents.GetAssociatedLayout();
  events = externalEvents.events;
}

void ExternalEvents::SerializeTo(SerializerElement& element) const {
  element.SetAttribute("name", name);
  element.SetAttribute("associatedLayout", associatedScene);
  events.SerializeTo(element.AddChild("events"));
}

void ExternalEvents::UnserializeFrom(gd::Project& project,
                                     const SerializerElement& element) {
  if (element.HasChild("sceneLifecycleFunctions") ||
      element.HasChild("sceneLoadEvents") ||
      element.HasChild("sceneSignalEvents") ||
      element.HasChild("sceneUnloadEvents")) {
    throw std::logic_error(
        "External events are single event fragments; lifecycle bodies are not supported.");
  }
  name = element.GetStringAttribute("name");
  associatedScene = element.GetStringAttribute("associatedLayout");
  events.UnserializeFrom(project, element.GetChild("events"));
}

}  // namespace gd
