Maps draws guidance on the game’s own maps: an exploration grid, walkable terrain, a walking route, range rings on the Compass and an elite skill planner. Each layer has its own switch.

### Layers
- **Exploration grid** shows the cells you can still explore on the Mission Map and World Map. Hollow amber markers are estimates. Solid orange markers are confirmed for the map you are in.
- **Walkable terrain** shades the areas you cannot walk on, on the Compass and Mission Map.
- **Walking route** draws a yellow line from you to a point you set, on the Compass, Mission Map and World Map.
- **Compass ranges** draws rings for Shout, Cast, Spirit and Ext. Spirit range around you.
- **Markers on Compass** adds nearby unexplored cells to the Compass.

Hold Shift over a Mission Map cell to see the 3×3 area standing there reveals. Hold Option and Shift for the 7×7 Bird’s Eye area.

### Walking route
1. Right-click the Mission Map or World Map to set a point.
2. Follow the line on the Compass.
3. Right-click the point again to remove it.

The line follows walkable ground and updates when you leave it. When no walkable way reaches the point, the line ends on the nearest ground and a dotted line shows the rest. The point stays when you travel to another area of the same continent, so you can set it on the World Map and follow it across several areas. It is removed when you reach another continent or close the game. In another area, the line leads to the ground nearest the point, which is not always the exit you need.

Without a point of your own, the line leads to your active quest, the same place the game’s quest marker shows. When the quest is in another area, it leads to the exit the game marks. Your own point always wins; remove it to follow the quest again. Turn this off with :setting[Route to quest]{to="maps/cartographyQuestRouteEnabled"}.

### Elite skill planner
The planner helps you capture elite skills. It lists every elite skill with its boss, where to find the boss, and whether this character has learned the skill. Open the World Map and select the control in its upper-right corner. From the Build Library’s skill view, **Find capture locations** opens the same details.

Star a skill to add it to your **Hunt list**. The next boss on that list becomes your **target** automatically: this area first, then this region. Use **Set target** to pick another, and **Use automatic target** to go back. A captured skill stays on the list with a tick. **Remove captured from Hunt list** clears them. The Hunt list is kept for each character.

The planner switches between **All matches** and **Hunt list**. Filters apply to All matches: search, class buttons (**Mine** follows your professions), **Not learned**, **Learned** or **Any**, and region. On the Mission Map, boss markers show where the boss can spawn. Click a marker to set it as your target, add it to your Hunt list, or open the planner.

A skill counts as learned only when the game reports it for the current character. Boss positions are spawn points, not live positions.

### Details
- **Turn on:** :setting[Maps]{to="tools/tool:maps"}, off while you play the :setting[plain game]{to="tools/gwonmacTools"}. Then turn on the layers you want: :setting[Exploration grid]{to="maps/cartographyGridEnabled"}, :setting[Walkable terrain]{to="maps/cartographyOverlayEnabled"}, :setting[Walking route]{to="maps/cartographyRouteEnabled"} (on by default; nothing shows until you set a point), :setting[Compass ranges]{to="maps/compassRangeIndicatorsEnabled"}, :setting[Markers on Compass]{to="maps/cartographyCompassGridEnabled"} and :setting[Elite skill planner]{to="maps/eliteSkillsEnabled"}.
- **Open:** the round control beside the Compass shows or hides the Compass range rings and has options for them. :setting[Settings → Maps]{to="maps"} has the switch for every layer. You can assign a shortcut to **Exploration grid**, **Walkable terrain** and **Walking route** there; all start unassigned. In the [Hub]($docs.hub), the **Maps** row opens these settings.
- **Settings:** :setting[Map style]{to="maps/cartographyPresetLibrary"} (Cartographer, Synthwave, Monochrome, or your own), :setting[Terrain border thickness]{to="maps/cartographyBoundaryWidth"}, :setting[Grid opacity]{to="maps/cartographyGridOpacity"}, :setting[Reveal range]{to="maps/cartographyRevealMode"} (Off, Normal · 3×3, Bird’s Eye · 7×7), :setting[Walkable terrain opacity]{to="maps/cartographyWalkabilityOpacity"}, :setting[Compass control visibility]{to="maps/cartographyControlIdleOpacity"} and :setting[Mission Map markers]{to="maps/eliteMissionMapMarkers"} for the planner (**Hunt list**, **All planner matches** or **Off**). Compass ranges can be set to Color or Monochrome, and each ring can be turned off.
- **Compass buttons:** the two buttons beside the Compass are optional. Turn :setting[Show compass buttons]{to="maps/compassButtonsShown"} off to hide them; every choice they offer stays in Settings → Maps. To move them, drag either button in a game window at any time; :setting[Compass buttons position]{to="maps/compassButtonsOffset"} has **Reset position**. They keep following the Compass.
- **Limits:** supported PvE maps only. The grid covers Pre-Searing, Tyria, Cantha and Elona. In dungeons, underground maps, the Battle Isles and the Realm of Torment, the grid hides and only walkable terrain stays. The layers return after you travel to a fully supported area. You can edit Maps settings in the plain game; the layers show once you turn off the plain game and turn on Maps.

> The route to your quest is solid. The route to your own point is dashed.
