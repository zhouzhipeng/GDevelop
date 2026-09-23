/*
 * GDevelop Core
 * Copyright 2008-2016 Florian Rival (Florian.Rival@gmail.com). All rights
 * reserved. This project is released under the MIT License.
 */
#include "GDCore/IDE/DependenciesAnalyzer.h"
#include "GDCore/Events/Builtin/LinkEvent.h"
#include "GDCore/Project/ExternalEvents.h"
#include "GDCore/Project/Layout.h"
#include "GDCore/Project/Project.h"
#include "catch.hpp"

TEST_CASE("DependenciesAnalyzer", "[common]") {
  SECTION("Scene names are not Link dependencies") {
    gd::Project project;
    auto& layout1 = project.InsertNewLayout("Layout1", 0);
    project.InsertNewLayout("Layout2", 1);

    gd::LinkEvent link;
    link.SetTarget("Layout2");
    layout1.GetEvents().InsertEvent(link);

    DependenciesAnalyzer analyzer(project, layout1);
    REQUIRE(analyzer.Analyze());
    REQUIRE(analyzer.GetExternalEventsDependencies().empty());
  }

  SECTION("Finds transitive external event dependencies") {
    gd::Project project;
    auto& layout = project.InsertNewLayout("Layout", 0);
    auto& first = project.InsertNewExternalEvents("First", 0);
    project.InsertNewExternalEvents("Second", 1);

    gd::LinkEvent toFirst;
    toFirst.SetTarget("First");
    layout.GetEvents().InsertEvent(toFirst);
    gd::LinkEvent toSecond;
    toSecond.SetTarget("Second");
    first.GetEvents().InsertEvent(toSecond);

    DependenciesAnalyzer analyzer(project, layout);
    REQUIRE(analyzer.Analyze());
    REQUIRE(analyzer.GetExternalEventsDependencies().size() == 2);
    REQUIRE(analyzer.GetExternalEventsDependencies().count("First") == 1);
    REQUIRE(analyzer.GetExternalEventsDependencies().count("Second") == 1);
  }

  SECTION("Detects circular external event dependencies") {
    gd::Project project;
    auto& layout = project.InsertNewLayout("Layout", 0);
    auto& first = project.InsertNewExternalEvents("First", 0);
    auto& second = project.InsertNewExternalEvents("Second", 1);

    gd::LinkEvent toFirst;
    toFirst.SetTarget("First");
    layout.GetEvents().InsertEvent(toFirst);
    gd::LinkEvent toSecond;
    toSecond.SetTarget("Second");
    first.GetEvents().InsertEvent(toSecond);
    gd::LinkEvent backToFirst;
    backToFirst.SetTarget("First");
    second.GetEvents().InsertEvent(backToFirst);

    DependenciesAnalyzer analyzer(project, layout);
    REQUIRE_FALSE(analyzer.Analyze());
  }
}
