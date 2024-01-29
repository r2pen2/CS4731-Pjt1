function main() {
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

    document.getElementById('files').addEventListener('change', (e) => loadSVG(e, canvas, gl, program), false);

    canvas.addEventListener('wheel', (e) => handleZoom(e, gl));

    canvas.addEventListener('mousedown', (event) => {
        isDragging = true;
        dragStart.x = event.clientX;
        dragStart.y = event.clientY;
    });

    let dragged = false;

    const movementFrameRate = 24;

    function doMovementTick() {
        if (dragged) {
            dragged = false;
            renderLines(gl, program);
        }
        setTimeout(doMovementTick, 1000/movementFrameRate);
    }

    doMovementTick();
    
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
    
    canvas.addEventListener('mouseup', (event) => {
        isDragging = false;
        currentOffset.x += cameraOffset.x;
        currentOffset.y += cameraOffset.y;
        cameraOffset.x = 0;
        cameraOffset.y = 0;
    });
    
    canvas.addEventListener('mouseleave', (event) => {
        isDragging = false;
    });    
}

let zoom = 1;

let linesArray = [];

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraOffset = { x: 0, y: 0 };
let currentOffset = { x: 0, y: 0 };

function handleZoom(e, gl) {
    e.preventDefault();
    if (e.deltaY < 0) {
        zoom *= 1.1;
    } else {
        zoom /= 1.1;
    }
    // Re-render
    renderLines(gl, program);
}

function getCanvasCoordinate(e, canvas) {
    const bounds = canvas.getBoundingClientRect();
    const x = ((e.clientX - bounds.left) * 2 / canvas.width) - 1;
    const y = ((canvas.height - (e.clientY - bounds.top)) * 2/ canvas.height) - 1;
    return { x, y };
}

let showViewBox = false;

function toggleViewBox() {
    showViewBox = document.getElementById("viewBoxCheckbox").checked;
}

function loadSVG(event, canvas, gl, program) {
  const reader = new FileReader();


  reader.onload = function(e) {
    const svgContent = e.target.result;
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const viewBox = doc.getElementsByTagName("svg")[0].getAttribute("viewBox").split(" ");
    const lines = doc.getElementsByTagName("line");
    
    const vbX1 = +viewBox[0];
    const vbY1 = +viewBox[1];
    const vbX2 = +viewBox[2];
    const vbY2 = +viewBox[3];

    const vbXRange = Math.abs(vbX2 - vbX1);
    const vbYRange = Math.abs(vbY2 - vbY1);
    const scale = vbXRange > vbYRange ? vbXRange : vbYRange;

    function canvasizeX(x) {
        return (x / scale) - (vbX1 / scale) - (vbXRange / (scale * 2));
    }
    function canvasizeY(y) {
        return (y / scale) - (vbY1 / scale) - (vbYRange / (scale * 2));
    }

    function renderViewBox() {
        if (!showViewBox) { return; }
        linesArray.push({ x1: canvasizeX(vbX1), y1: canvasizeY(vbY1), x2: canvasizeX(vbX2), y2: canvasizeY(vbY1), stroke: "#000000" });
        linesArray.push({ x1: canvasizeX(vbX1), y1: canvasizeY(vbY2), x2: canvasizeX(vbX2), y2: canvasizeY(vbY2), stroke: "#000000" });
        linesArray.push({ x1: canvasizeX(vbX1), y1: canvasizeY(vbY1), x2: canvasizeX(vbX1), y2: canvasizeY(vbY2), stroke: "#000000" });
        linesArray.push({ x1: canvasizeX(vbX2), y1: canvasizeY(vbY1), x2: canvasizeX(vbX2), y2: canvasizeY(vbY2), stroke: "#000000" });
        // console.log(linesArray)
    }

    
    // Render each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        const x1 = canvasizeX(+line.getAttribute("x1"));
        const y1 = canvasizeY(+line.getAttribute("y1"));
        const x2 = canvasizeX(+line.getAttribute("x2"));
        const y2 = canvasizeY(+line.getAttribute("y2"));
        
        // I want to center the whole thing
        
        const stroke = line.getAttribute("stroke")
        const newLine = {
            x1: x1,
            y1: -y1,
            x2: x2,
            y2: -y2,
            stroke: stroke
        }
        linesArray.push(newLine);
    }
    
    renderViewBox() // Add viewbox
    // Render each line
    renderLines(gl, program);
  };
  reader.readAsText(event.target.files[0]);
}

function renderLines(gl, program) {
    gl.clear(gl.COLOR_BUFFER_BIT)

    const uZoom = gl.getUniformLocation(program, 'uZoom');
    gl.uniform1f(uZoom, zoom)

    const uCameraOffset = gl.getUniformLocation(program, 'uCameraOffset');
    gl.uniform2f(uCameraOffset, cameraOffset.x + currentOffset.x, -(cameraOffset.y + currentOffset.y));

    for (let i = 0; i < linesArray.length; i++) {
        const line = linesArray[i];
        renderLine(gl, program, line);
    }
    gl.flush()
}

function renderLine(gl, program, line) {
    
    const stroke = line.stroke

    // console.log(line)
    
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

function hexToRgb(hex) {
    if (hex.charAt(0) === '#') { hex = hex.slice(1); }
    var bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}
