/*
 * GDevelop Core
 * Copyright 2008-2016 Florian Rival (Florian.Rival@gmail.com). All rights
 * reserved. This project is released under the MIT License.
 */
#pragma once

#include <map>
#include <memory>

#include "GDCore/Serialization/Serializer.h"
#include "GDCore/String.h"

namespace gd {
class PropertyDescriptor;
class SerializerElement;
class Project;
class Layout;
class ArbitraryResourceWorker;
}  // namespace gd

namespace gd {

/**
 * \brief Base class for containers of behavior configuration.
 * They can be attached to objects (Behavior) or layouts (BehaviorsSharedData).
 * It stores the content (i.e: the properties) of a behavior of an object.
 *
 * \see gd::Behavior
 * \see gd::BehaviorsSharedData
 * \ingroup PlatformDefinition
 */
class GD_CORE_API BehaviorConfigurationContainer {
 public:
  BehaviorConfigurationContainer()
      : folded(false) {};
  BehaviorConfigurationContainer(const gd::String& name_,
                                 const gd::String& type_)
      : name(name_),
        type(type_),
        folded(false) {};
  virtual ~BehaviorConfigurationContainer();

  /**
   * \brief Return the name identifying the behavior
   */
  const gd::String& GetName() const { return name; }

  /**
   * \brief Change the name identifying the behavior
   */
  void SetName(const gd::String& name_) { name = name_; }

  /**
   * \brief Return the type of the behavior
   */
  const gd::String& GetTypeName() const { return type; }

  /**
   * \brief Set the type of the behavior.
   */
  void SetTypeName(const gd::String& type_) { type = type_; };

  /**
   * \brief Called when the IDE wants to know about the custom properties of the
   * behavior.
   *
   * \return a std::map with properties names as key.
   * \see gd::PropertyDescriptor
   */
  std::map<gd::String, gd::PropertyDescriptor> GetProperties() const;

  /**
   * \brief Called when the IDE wants to update a custom property of the
   * behavior
   *
   * \return false if the new value cannot be set
   */
  bool UpdateProperty(const gd::String& name, const gd::String& value);

  /**
   * \brief Called when the IDE wants to rename a custom property of the object
   * configuration.
   *
   * \return false if properties can't be renamed
   */
  virtual bool RenameProperty(const gd::String &oldName,
                              const gd::String &newName) {
    if (usesInheritedDefaults) {
      RenameProperty(propertyOverrides, oldName, newName);
      RenameProperty(inheritedDefaults, oldName, newName);
    }
    return RenameProperty(content, oldName, newName);
  };

  /**
   * \brief Called when the IDE wants to remove a custom property from the
   * behavior
   *
   * \see gd::InitialInstance
   */
  void RemoveProperty(const gd::String &name) {
    auto& values = usesInheritedDefaults ? propertyOverrides : content;
    values.RemoveChild(name);
    values.RemoveAttribute(name);
    const auto uncapitalizedName = name.UncapitalizeFirstLetter();
    values.RemoveChild(uncapitalizedName);
    values.RemoveAttribute(uncapitalizedName);
    if (usesInheritedDefaults) {
      content = inheritedDefaults;
      UnserializeFromWithDefaultContent(propertyOverrides);
    }
  };

  /**
   * \brief Called to check if a property is overriden.
   *
   * \see gd::InitialInstance
   */
  bool HasPropertyValue(const gd::String name) const {
    const auto& values = usesInheritedDefaults ? propertyOverrides : content;
    if (values.HasChild(name) || values.HasAttribute(name)) return true;
    const auto uncapitalizedName = name.UncapitalizeFirstLetter();
    return values.HasChild(uncapitalizedName) ||
           values.HasAttribute(uncapitalizedName);
  }

  /**
   * \brief Called to initialize the content with the default properties
   * for the behavior.
   */
  virtual void InitializeContent() {
    InitializeContent(content);
  };

  /**
   * \brief Called to remove all properties values for the behavior.
   * 
   * \see gd::InitialInstance
   */
  void ClearContent() {
    content.Clear();
    propertyOverrides.Clear();
    inheritedDefaults.Clear();
    usesInheritedDefaults = false;
  };

  /**
   * \brief Serialize the behavior content.
   */
  virtual void SerializeTo(gd::SerializerElement& element) const {
    if (usesInheritedDefaults && !materializeInheritedContent) {
      element.Clear();
      element.AddChild("overrides") = propertyOverrides;
    } else {
      element = content;
    }
  };

  /**
   * \brief Unserialize the behavior content.
   */
  virtual void UnserializeFrom(const gd::SerializerElement& element) {
    if (element.HasChild("overrides")) {
      propertyOverrides = element.GetChild("overrides");
      usesInheritedDefaults = true;
      content = inheritedDefaults;
      UnserializeFromWithDefaultContent(propertyOverrides);
    } else {
      content = element;
      usesInheritedDefaults = false;
      propertyOverrides.Clear();
    }
  };

  /**
   * \brief Overlay serialized behavior content on top of the content already
   * initialized by the behavior extension.
   *
   * This is intended for ordinary behavior and shared-data deserialization.
   * Overriding behaviors must keep using \ref UnserializeFrom because their
   * sparse content represents inheritance.
   */
  void UnserializeFromWithDefaultContent(
      const gd::SerializerElement& element);

  // Effective content is a cache; only explicit overrides are authored data.
  void ApplyInheritedDefaults(const gd::SerializerElement& defaults);
  void ResetInheritedPropertyOverrides();
  void SerializeEffectiveTo(gd::SerializerElement& element) const { element = content; }
  void SetMaterializeInheritedContent(bool value) {
    materializeInheritedContent = value;
  }

  const gd::SerializerElement& GetContent() const { return content; };
  gd::SerializerElement& GetContent() { return content; };

  /**
   * \brief Set if the behavior configuration panel should be folded in the UI.
   */
  void SetFolded(bool fold = true) { folded = fold; }

  /**
   * \brief True if the behavior configuration panel should be folded in the UI.
   */
  bool IsFolded() const { return folded; }

  /**
   * \brief Called ( e.g. during compilation ) so as to inventory internal
   * resources and sometimes update their filename. Implementation example:
   * \code
   * worker.ExposeImage(myImage);
   * worker.ExposeFile(myResourceFile);
   * \endcode
   *
   * \see ArbitraryResourceWorker
   */
  void ExposeResources(gd::ArbitraryResourceWorker& worker);

 protected:
  /**
   * \brief Called when the IDE wants to know about the custom properties of the
   * behavior.
   *
   * Implementation example:
   \code
      std::map<gd::String, gd::PropertyDescriptor> properties;
      properties[_("Initial speed")].SetValue(gd::String::From(initialSpeed));

      return properties;
   \endcode
   *
   * \return a std::map with properties names as key.
   * \see gd::PropertyDescriptor
   */
  virtual std::map<gd::String, gd::PropertyDescriptor> GetProperties(
      const gd::SerializerElement& behaviorContent) const;

  /**
   * \brief Called when the IDE wants to update a custom property of the
   * behavior
   *
   * \return false if the new value cannot be set
   */
  virtual bool UpdateProperty(gd::SerializerElement& behaviorContent,
                              const gd::String& name,
                              const gd::String& value) {
    return false;
  };

  /**
   * \brief Called when the IDE wants to rename a custom property of the object
   * configuration.
   *
   * \return false if properties can't be renamed
   */
  virtual bool RenameProperty(gd::SerializerElement &behaviorContent,
                              const gd::String &oldName,
                              const gd::String &newName) {
    return false;
  };

  /**
   * \brief Called to initialize the content with the default properties
   * for the behavior.
   */
  virtual void InitializeContent(gd::SerializerElement& behaviorContent) {};

 private:
  void RemoveInheritedOverrideForProperty(const gd::String& name, const gd::String& value);

  gd::String name;  ///< Name of the behavior
  gd::String type;  ///< The type of the behavior that is represented. Usually
                    ///< in the form "ExtensionName::BehaviorTypeName"

  gd::SerializerElement content;  // Storage for the behavior properties
  bool folded;
  bool usesInheritedDefaults = false;
  bool materializeInheritedContent = false;
  gd::SerializerElement inheritedDefaults;
  gd::SerializerElement propertyOverrides;
};

}  // namespace gd
