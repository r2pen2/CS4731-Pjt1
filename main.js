/** The rate at which to update the canvas with any drag events */
let movementFrameRate = 24; // Defaults to 24 FPS

/** Current zoom level */
let zoom = 1;
/** Min zoom */
const zoomFloor = 0.1;
/** Max zoom */
const zoomCeiling = 10.0; 

/** Lines loaded from SVG upload */
let loadedLines = [];
/** Lines that the user has added */
let drawnLines = [];

/** Whether user is dragging the image: used to determine whether we need to do any re-renders at all */
let isDragging = false;
/** Whether we've dragged since last interaction */
let dragged = false;
/** Where the user started dragging */
let dragStart = { x: 0, y: 0 };
/** How much the user has dragged the image in total */
let cameraOffset = { x: 0, y: 0 };
/** How much the user has dragged the image since the last time they released the mouse */
let currentOffset = { x: 0, y: 0 };

/** Angle to rotate the camera */
let rotationAngle = 0;

/** First click point for a new line */
let newLinePoint1 = { x: null, y: null };

function main() {

    // Get the current framerate setting from DOM
    updateFramerate();

    // Retrieve <canvas> element
    let canvas = document.getElementById('webgl');

    // Get the rendering context for WebGL
    gl = WebGLUtils.setupWebGL(canvas, undefined);

    // Check that the return value is not null.
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Initialize shaders
    program = initShaders(gl, "vshader", "fshader");
    gl.useProgram(program);

    // Set up the viewport
    gl.viewport(0, 0, 400, 400);

    /** Listen for file upload changes */
    document.getElementById('files').addEventListener('change', (e) => loadSVG(e, gl, program), false);

    /** Handle mouse wheel interaction: w/ shift zooms and w/0 shift rotates */
    canvas.addEventListener('wheel', (e) => {
        if (e.shiftKey) {
            handleZoom(e, gl)
        } else {
            handleRotate(e, gl)
        }
    });

    canvas.oncontextmenu = (e) => e.preventDefault(); // Disable right click menu

    /** Start a drag on mousedown OR handle drawing a new line */
    canvas.addEventListener('mousedown', (event) => {
        if (event.button === 0) {
            // This is a left click
            isDragging = true;
            dragStart.x = event.clientX;
            dragStart.y = event.clientY;
        } else if (event.button === 2) {
            // This is a right click
            handleRightClick(event, canvas, gl, program)
        }
    });

    /** Handle movement ticks whenever they occur */
    function doMovementTick() {
        if (dragged) {
            dragged = false;
            renderLines(gl, program);
        }
        setTimeout(doMovementTick, 1000/movementFrameRate);
    }

    // Start movement clock
    doMovementTick();
    
    /** Handle mouse movement when dragging */
    canvas.addEventListener('mousemove', (event) => {
        if (isDragging) {
            const dx = event.clientX - dragStart.x;
            const dy = event.clientY - dragStart.y;
            dragStart.x = event.clientX;
            dragStart.y = event.clientY;
    
            cameraOffset.x += dx;
            cameraOffset.y += dy;

            dragged = true;
        }
    });
    
    /** Stop dragging when mouseup happens */
    canvas.addEventListener('mouseup', (event) => {
        isDragging = false;
        currentOffset.x += cameraOffset.x;
        currentOffset.y += cameraOffset.y;
        cameraOffset.x = 0;
        cameraOffset.y = 0;
    });
    
    /** Stop dragging when mouse leaves canvas */
    canvas.addEventListener('mouseleave', (event) => {
        isDragging = false;
    });

    /** When r is pressed, reset the canvas */
    document.addEventListener('keydown', (event) => {
        if (event.key === "r") {
            resetImage();
        }
    })
}

/**
 * Draw a new line
 * @param {MouseEvent} e - The mouse event.
 * @param {HTMLCanvasElement} canvas - The canvas.
 * @param {WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {WebGLProgram} program - The WebGL program.
 */
function handleRightClick(e, canvas, gl, program) {
    e.preventDefault();
    const { x, y } = getCanvasCoordinate(e, canvas);
    // console.log(`Right click at (${x}, ${y})`);
    if (newLinePoint1.x && newLinePoint1.y) {
        // We already have a first point
        const newLine = { x1: newLinePoint1.x, y1: newLinePoint1.y, x2: x, y2: y, stroke: "#000000" };
        drawnLines.push(newLine);
        renderLines(gl, program);
        const persistRightClick = document.getElementById("persist-right-click-checkbox").checked;
        if (persistRightClick) {
            newLinePoint1.x = x;
            newLinePoint1.y = y;
        } else { 
            newLinePoint1.x = null;
            newLinePoint1.y = null;
        }
    } else {
        // Set first point
        newLinePoint1.x = x;
        newLinePoint1.y = y;
    }
}

function handlePersistanceChange() {
    const persistRightClick = document.getElementById("persist-right-click-checkbox").checked;
    if (!persistRightClick) {
        newLinePoint1.x = null;
        newLinePoint1.y = null;
    }
}

/** Change the framerate for custom performance */
const updateFramerate = () => movementFrameRate = parseInt(document.getElementById("framerate").value);

/** Called when the user scrolls without holding shift. Updates the rotation angle according to scroll direction. */
function handleRotate(e, gl) {
    const rotationStep = 5;
    rotationAngle += e.deltaY > 0 ? rotationStep : -rotationStep;
    renderLines(gl, program);
}

/** Called when the user scrolls while holding shift. Updates the zoom level according to scroll direction. */
function handleZoom(e, gl) {
    e.preventDefault();
    if (e.deltaY < 0) {
        if (zoom >= zoomCeiling) { return; }
        zoom *= 1.1;
    } else {
        if (zoom <= zoomFloor) { return; }
        zoom /= 1.1;
    }
    // Re-render
    renderLines(gl, program);
}

/**
 * Convert mouse coordinates into canvas coordinates
 * @param {MouseEvent} e - The mouse event.
 * @param {HTMLCanvasElement} canvas - The canvas.
 **/
function getCanvasCoordinate(e, canvas) {
    const bounds = canvas.getBoundingClientRect();
    let x = ((e.clientX - bounds.left) * 2 / canvas.width) - 1;
    let y = ((canvas.height - (e.clientY - bounds.top)) * 2/ canvas.height) - 1;
    
    x -= currentOffset.x / 200;
    y += currentOffset.y / 200;

    x /= zoom;
    y /= zoom;

    // console.log(`(${currentOffset.x}, ${currentOffset.y})`)
    // console.log(`(${x}, ${y})`)

    return { x, y };
}

/**
 * Erases all lines from the canvas.
 */
function eraseLines() {
    loadedLines = [];
    drawnLines = [];
}

/**
 * Load an SVG into memory and draw it on the canvas
 * @param {*} event form submission event
 * @param {WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {WebGLProgram} program - The WebGL program.
 */
function loadSVG(event, gl, program) {
    const reader = new FileReader();

    // Wipe any previously loaded / drawn lines & return camera to center
    resetImage();

    // Hide any alerts
    hideViewBoxAlert();

    // Reset drawing
    newLinePoint1 = { x: null, y: null };

    reader.onload = (e) => {
        /** Raw SVG content from file upload */
        const svgContent = e.target.result;
        /** DOM parser to read SVG into a string */
        const parser = new DOMParser();
        /** SVG DOM object */
        const doc = parser.parseFromString(svgContent, "image/svg+xml");
        /** SVG's viewbox */
        const viewBox = doc.getElementsByTagName("svg")[0].getAttribute("viewBox").split(" ");
        /** List of lines in the SVG */
        const lines = doc.getElementsByTagName("line");
        
        /** Viewbox x1 bound */
        const vbX1 = +viewBox[0];
        /** Viewbox y1 bound */
        const vbY1 = +viewBox[1];
        /** Viewbox x2 bound */
        const vbX2 = +viewBox[2];
        /** Viewbox y2 bound */
        const vbY2 = +viewBox[3];
        /** Viewbox width (in arbitrary viewbox units) */
        const vbXRange = Math.abs(vbX2 - vbX1);
        /** Viewbox height (in arbitrary viewbox units) */
        const vbYRange = Math.abs(vbY2 - vbY1);
        /** How much to scale SVG coordinates in order to fit between 0 and 1 */
        const scale = vbXRange > vbYRange ? vbXRange : vbYRange;

        // God these took forever to figure out. Translate an image to the center of the canvas so that camera operations are centered around the viewbox.
        function canvasizeX(x) { 
            // // return ((x / scale) - (vbX1 / scale) - (vbXRange / (scale * 2))) * 2; 
            /** Translate this x coordinate w/ context for how long the viewbox is */
            const aspectRatioAdjustment = vbXRange / 2;
            /** Bring the min X coordinate to 0 */
            const zeroedX = x - vbX1; 
            /** Coordinate range should be from -.5 to .5. We want it to be -1 to 1, so we multiply by 2. */
            const fitToCanvas = 2;
            return fitToCanvas * (zeroedX - aspectRatioAdjustment) / scale; // Multiplied by 2 now that we're normalized— fit to canvas instead of quadrant 
        }

        function canvasizeY(y) { 
            // // return ((y / scale) - (vbY1 / scale) - (vbYRange / (scale * 2))) * 2;
            /** Translate this y coordinate w/ context for how tall the viewbox is */
            const aspectRatioAdjustment = vbYRange / 2;
            /** Bring the min Y coordinate to 0 */
            const zeroedY = y - vbY1;
            /** See {@link canvasizeX}: Y is inverted because SVG origin is top-left */
            const fitToCanvas = -2;
            return fitToCanvas * (zeroedY - aspectRatioAdjustment) / scale; // Multiplied by 2 now that we're normalized— fit to canvas instead of quadrant
        }

        /**
         * Renders the viewbox on the canvas. This was initially for debugging, but I kinda like it!
         */
        function renderViewBox() {
            const showViewBox = document.getElementById("viewBoxCheckbox").checked;
            if (!showViewBox) { return; }
            loadedLines.push({ x1: canvasizeX(vbX1), y1: -canvasizeY(vbY1), x2: canvasizeX(vbX2), y2: -canvasizeY(vbY1), stroke: "#000000" });
            loadedLines.push({ x1: canvasizeX(vbX1), y1: -canvasizeY(vbY2), x2: canvasizeX(vbX2), y2: -canvasizeY(vbY2), stroke: "#000000" });
            loadedLines.push({ x1: canvasizeX(vbX1), y1: -canvasizeY(vbY1), x2: canvasizeX(vbX1), y2: -canvasizeY(vbY2), stroke: "#000000" });
            loadedLines.push({ x1: canvasizeX(vbX2), y1: -canvasizeY(vbY1), x2: canvasizeX(vbX2), y2: -canvasizeY(vbY2), stroke: "#000000" });
        }

        // Render each line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // I want to center the whole thing
            const x1 = canvasizeX(+line.getAttribute("x1"));
            const y1 = canvasizeY(+line.getAttribute("y1"));
            const x2 = canvasizeX(+line.getAttribute("x2"));
            const y2 = canvasizeY(+line.getAttribute("y2"));

            const stroke = line.getAttribute("stroke")
            const newLine = { x1: x1, y1: y1, x2: x2, y2: y2, stroke: stroke }
            loadedLines.push(newLine);

            if (x1 < -1 || x1 > 1 || x2 < -1 || x2 > 1 || y1 < -1 || y1 > 1 || y2 < -1 || y2 > 1) {
                showViewBoxAlert();
            }
        }

        renderViewBox() // Add viewbox (if checked)
        // Render each line
        renderLines(gl, program);
    };
    reader.readAsText(event.target.files[0]);
    shoot();
}

/** Reset the current image but DO NOT erase SVG loaded lines */
function resetImage() {
    drawnLines = [];
    zoom = 1;
    cameraOffset = { x: 0, y: 0 };
    currentOffset = { x: 0, y: 0 };
    rotationAngle = 0;
    renderLines(gl, program);
}

/**
 * Renders {@link loadedLines} and {@link drawnLines} on the WebGL canvas.
 * @param {WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {WebGLProgram} program - The WebGL program.
 */
function renderLines(gl, program) {
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Handle zoom
    const uZoom = gl.getUniformLocation(program, 'uZoom');
    gl.uniform1f(uZoom, zoom)

    // Handle camera offset
    const uCameraOffset = gl.getUniformLocation(program, 'uCameraOffset');
    gl.uniform2f(uCameraOffset, cameraOffset.x + currentOffset.x, -(cameraOffset.y + currentOffset.y));

    // Handle rotation
    const angleRadians = rotationAngle * Math.PI / 180;
    const uRotationAngle = gl.getUniformLocation(program, 'uRotationAngle');
    gl.uniform1f(uRotationAngle, angleRadians);

    /** Concat loaded lines and drawn lines */
    const allLines = loadedLines.concat(drawnLines);

    // Render each line
    allLines.forEach(line => renderLine(gl, program, line));

    gl.flush() // I read online that this is important sometimes
}

/**
 * Renders a single line on the WebGL canvas.
 * @param {WebGLRenderingContext} gl - The WebGL rendering context.
 * @param {WebGLProgram} program - The WebGL program.
 * @param {Object} line - The line to render.
 */
function renderLine(gl, program, line) {
  
    /** Stroke color */
    const stroke = line.stroke
    
    /** Vetricies array */
    const vertices = new Float32Array([line.x1, line.y1, line.x2, line.y2]);

    // Create buffer
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Enable attr
    const vPosition = gl.getAttribLocation(program, 'vPosition');
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Handle all of the stroke color stuff
    const strokeRGB = hexToRgb(stroke);
    // console.log(strokeRGB)
    const uColor = gl.getUniformLocation(program, 'uColor');
    gl.uniform4f(uColor, strokeRGB.r / 255, strokeRGB.g / 255, strokeRGB.b / 255, 1.0);

    // Draw
    gl.drawArrays(gl.LINES, 0, 2);
};

/**
 * Convert hex code to RGB values
 */
function hexToRgb(hex) {
    if (hex.charAt(0) === '#') { hex = hex.slice(1); }
    var bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

/** 
 * Shoot confetti to make my submission a little more "graphic" 
 * */
function shoot() {

    /** Random delay between bursts */
    const getShotDelay = () => Math.floor(Math.random() * 300) + 150
    
    /** Max number of confetti shots */
    const maxShots = 4;
    /** Number of left shots remaining */
    let leftShots = Math.floor(Math.random() * maxShots) + 1;
    /** Number of right shots remaining */
    let rightShots = Math.floor(Math.random() * maxShots) + 1;
    
    /** Shoot confetti from the left */
    const shootLeft = () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0, x: 0.4 },
            angle: -60
        });
        leftShots--;
        if (leftShots > 0) { 
            setTimeout(shootLeft, getShotDelay());
        }
    };

    /** Shoot confetti from the right */
    const shootRight = () => {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0, x: 0.6 },
            angle: -120
        });
        rightShots--;
        if (rightShots > 0) { 
            setTimeout(shootRight, getShotDelay());
        }
    }

    // GO!
    shootLeft();
    shootRight();
}

/** Warn the user if their uploaded SVG is not confined to the viewbox */
function showViewBoxAlert() {
    const alert = document.getElementById("viewbox-alert");
    if (alert.classList.contains("show")) { return; }
    alert.classList.add("show");
}

/** Hide viewbox alert when we haven't parsed any lines yet */
function hideViewBoxAlert() {
    const alert = document.getElementById("viewbox-alert");
    if (!alert.classList.contains("show")) { return; }
    alert.classList.remove("show");
}