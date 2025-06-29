# Exporter

This package is responsible for handling file exports. Both the creation of the `.TOP` file, and also parsing the data.

## V1 Schema

A `.TOP` file is a zip container that contains the following files:
- `version` - A text file containing the version number of this file format. In this case, it is 1.0.0
- `data.sqlite` - An Sqlite file that contains most of the data that we need
- `media` - A media folder that contains all the media needed for this project
  - myFile.mp4
  - ......

