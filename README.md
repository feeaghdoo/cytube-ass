# cytube-ass

Adds SubtitlesOctopus (https://github.com/libass/JavascriptSubtitlesOctopus) support to a cytube (https://github.com/calzoneman/sync/) channel. Written for a specific channel so has channel-specific stuff, can probably be modified for someone else's.

## Install

1. Throw the files somewhere
2. Import cytube-ass.js however you import external scripts
3. Add the following lines to your channel JS:

```
var subtitles = [];
var subtitleFonts = [];
var editableVariableLineNums = {subtitles: 0, subtitleFonts: 1};
var subtitlesWebWorkersPrefix = "https://example.com/libs/cytube-ass/libass-wasm";
```

and change the numbers of `var editableVariableLineNums = {subtitles: 0, subtitleFonts: 1};` to be the line numbers in your channel JS that have `var subtitles` and `var subtitleFonts`, with 1 subtracted from each (so if `var subtitleFonts` is on line 5, it should be `subtitles: 4`), and change `subtitlesWebWorkersPrefix` to be the path to the libass-wasm wherever you uploaded it.
