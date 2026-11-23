# Staged README lines

Lines for Walking route options that still have a `stage` in feature.ts, kept out of README.md so the
website and the launcher do not show them yet (docs/feature-contract.md#release-stages). When an
option ships, move its lines back to the place named here and delete them from this file.

## `cartographyQuestRouteEnabled` (Route to quest), stage `dev`

In README.md, under `### Walking route`, as the last paragraph:

Without a point of your own, the line leads to your active quest, the same place the game’s quest marker shows. When the quest is in another area, it leads to the exit the game marks. Your own point always wins; remove it to follow the quest again. Turn this off with :setting[Route to quest]{to="features/cartographyQuestRouteEnabled"}.

In README.md, as its last line (its one `>` note):

> The route to your quest is solid. The route to your own point is dashed.
