# UXGolf

Golf application for scoring your matches, with GPS positions.

## TODO

- Back, http-server
  - Serve courses
  - Authorization to save matches
  - Return main match data (date, player, index)
  - Self generation of slug
- Design
  - Icons
  - Screenshots for GitHub Readme
- Courses data
  - Pulnoy course SVG holes 10 to 18
  - Fix reference position hole 7 Pulnoy
- Front application
  - Update Player name + Index
  - Do not display distance if too far away
  - Ensure better GPS position after phone pause/lock (wait few seconds?)
  - Selection start color in a second menu
  - Serve courses from back
  - Try IndexedDb instead of LocalStorage
  - Possibility to remove a stroke
  - Mark the flag (manually, or maybe automatically from the possible positions of the course)
  - Sort matches by date
- PWA
  - Improve manifests
  - Force to download PWA to use it
