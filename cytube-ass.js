var subtitleOctopusInstance = null;
var playerResizeObserver = null;

//add subtitles when video added
function addSubtitles(newVidSrc) {
    var src = newVidSrc ? newVidSrc : ($('#queue a').length > 0 ? $('#queue a')[0].href : null);
    if (!subtitleOctopusInstance && document.querySelector('.video-js video') && src && subtitles.map(s => s.videoUrl).indexOf(src) !== -1) {
        var subData = subtitles[subtitles.map(s => s.videoUrl).indexOf(src)];
        //tricksyness to get past worker same-origin limitation (it's on MDN and works in all browsers so I guess it's a deliberate gap?)
        var workerScript = new Blob(["var IMPORT_BASE='" + subtitlesWebWorkersPrefix + "/'; importScripts('" + subtitlesWebWorkersPrefix + "/subtitles-octopus-worker.js');"], { type: 'application/javascript' });
        var workerScriptUrl = URL.createObjectURL(workerScript);
        var legacyWorkerScript = new Blob(["var IMPORT_BASE='" + subtitlesWebWorkersPrefix + "/'; importScripts('" + subtitlesWebWorkersPrefix + "/subtitles-octopus-worker-legacy.js');"], { type: 'application/javascript' });
        var legacyWorkerScriptUrl = URL.createObjectURL(legacyWorkerScript);
        var options = {
            video: document.querySelector('.video-js video'), // HTML5 video element
            subUrl: subData.subUrl, // Link to subtitles
            fonts: subtitleFonts, // Links to fonts (not required, default font already included in build)
            timeOffset: subData.timeOffset,
            workerUrl: workerScriptUrl, // Link to file "libassjs-worker.js"
            legacyWorkerUrl: legacyWorkerScriptUrl, // Link to non-WebAssembly worker
            renderMode: "lossy"
        };
        subtitleOctopusInstance = new SubtitlesOctopus(options);
        URL.revokeObjectURL(workerScriptUrl);
        URL.revokeObjectURL(legacyWorkerScriptUrl);

        //resize subtitles canvas when player resized (due to window resize etc)
        if (ResizeObserver) {
            playerResizeObserver = new ResizeObserver(function(entries) {
                var subCanvas = document.querySelector('.libassjs-canvas')
                for (var entry of entries) {
                    if (entry.contentBoxSize) {
                        subCanvas.style.height = entry.contentBoxSize.blockSize + 'px';
                        subCanvas.setAttribute('height', entry.contentBoxSize.blockSize + 'px');
                        subCanvas.style.width = entry.contentBoxSize.inlineSize + 'px';
                        subCanvas.setAttribute('width', entry.contentBoxSize.inlineSize + 'px');
                    } else {
                        subCanvas.style.height = entry.contentBoxSize.height + 'px';
                        subCanvas.setAttribute('height', entry.contentBoxSize.height + 'px');
                        subCanvas.style.width = entry.contentBoxSize.width + 'px';
                        subCanvas.setAttribute('width', entry.contentBoxSize.width + 'px');
                    }
                }
            });
            playerResizeObserver.observe(document.querySelector('.video-js video'));
        }
    }
}

//kill subtitles when video removed
function removeSubtitles() {
    if (playerResizeObserver) {
        playerResizeObserver.unobserve(document.querySelector('.video-js video'));
        playerResizeObserver = null;
    }
    if (subtitleOctopusInstance) {
        subtitleOctopusInstance.dispose();
        subtitleOctopusInstance = null;
    }
}

addSubtitles();
VideoJSPlayer.prototype.oldLoad = VideoJSPlayer.prototype.load;
VideoJSPlayer.prototype.load = function(data) { this.oldLoad(data); addSubtitles(data.id); };
VideoJSPlayer.prototype.oldDestroy = VideoJSPlayer.prototype.destroy;
VideoJSPlayer.prototype.destroy = function() { removeSubtitles(); this.oldDestroy(); };

//add sub parameter entry when google drive or raw file
$("#mediaurl").keyup(function() {
    var editSubs = false;
    try {
        if (parseMediaLink($("#mediaurl").val()).type === "fi" || parseMediaLink($("#mediaurl").val()).type === "gd" || parseMediaLink($("#mediaurl").val()).type === "cm") {
            editSubs = true;
        }
    } catch (error) {
    }
    
    if (editSubs && CLIENT.rank >= 2) {
        var subParams = $("#addfromurl-subparams");
        if (subParams.length === 0) {
            subParams = $("<div id='addfromurl-subparams'>" +
                          "<div><span>Sub URL (ASS file)</span><input class='form-control' type='text' id='addfromurl-sub-val'/></div>" +
                          "<div><span>Time offset (sec)</span><input class='form-control' type='text' id='addfromurl-offset-val'/></div>" +
                          "<div><span>Font URLs (one per line, for the entire session)</span><textarea class='form-control' id='addfromurl-fonts-val'>" + subtitleFonts.join('\n') + "</textarea></div>" +
                          "</div>")
                .appendTo($("#addfromurl"));
        }
    } else {
        $("#addfromurl-subparams").remove();
    }
});

//save off javascript literal thingy as-is as var in channel js
var editJsLiteral = function(fieldIndex, value) {
    if (window.CLIENT.rank >= 2) {
		var textField = jsTextField.val();
		var textFieldArray = textField.split("\n");
		var firstBlock = textFieldArray[fieldIndex].substr(0, textFieldArray[fieldIndex].lastIndexOf(' = ') + 1);
		textField = textField.replace(textFieldArray[fieldIndex], firstBlock + "= " + value + ";");
		jsTextField.val(textField);
		socket.emit("setChannelJS", {
			js: $("#cs-jstext").val()
		});
	}
}

//save off subtitle data
$("#queue_next, #queue_end").click(function() {
    var videoUrlVal = $("#mediaurl").val();
    var subUrlVal = $("#addfromurl-sub-val").val();
    var fontUrlVal = $("#addfromurl-fonts-val").val();
    var timeOffsetVal = $("#addfromurl-offset-val").val();
    if (subUrlVal && subUrlVal !== '') {
        var fixedUrl = videoUrlVal;
        fixedUrl = fixedUrl.replace("drive.google.com", "docs.google.com");
        if (fixedUrl.includes("docs.google.com")) {
            fixedUrl = fixedUrl.replace(/\/view.*$/, '');
        }
        var newSub = {videoUrl: fixedUrl, subUrl: subUrlVal, timeOffset: 0, timestamp: Date.now()};
        if (timeOffsetVal && timeOffsetVal !== '') {
            newSub.timeOffset = parseFloat(timeOffsetVal);
        }
        //remove old subtitles and old versions of same subtitle
        subtitles = subtitles.filter(function(s) { s.timestamp + 86400 > Date.now() && s.videoUrl != newSub.videoUrl});
        subtitles.push(newSub);
        editJsLiteral(editableVariableLineNums.subtitles, JSON.stringify(subtitles));
        $("#addfromurl-subparams").remove();
    }
        
    if (fontUrlVal && fontUrlVal !== '') {
        editJsLiteral(editableVariableLineNums.subtitleFonts, JSON.stringify(fontUrlVal.split('\n')));
    }
});

//prevent resize of main cytube pane which causes subtitles canvas to reset
var styleEl = document.createElement('style');
document.head.appendChild(styleEl);
var styleSheet = styleEl.sheet;
styleSheet.insertRule("#maincontain > .nano-content:hover { margin-right: -10px !important; }");	
