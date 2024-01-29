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
}

let zoom = 1;

let linesArray = [];

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
    
    function renderViewBox() {
        if (!showViewBox) { return; }

        console.log(vbXRange, vbYRange)

        const scale = vbXRange > vbYRange ? vbXRange : vbYRange;

        linesArray.push({
            x1: (vbX1 * scale),
            y1: (vbY1 * scale),
            x2: (vbX2 * scale),
            y2: (vbY1 * scale),
            stroke: "#000000"
        });
        linesArray.push({
            x1: (vbX1 * scale),
            y1: (vbY2 * scale),
            x2: (vbX2 * scale),
            y2: (vbY2 * scale),
            stroke: "#000000"
        });
        linesArray.push({
            x1: (vbX1 * scale),
            y1: (vbY1 * scale),
            x2: (vbX1 * scale),
            y2: (vbY2 * scale),
            stroke: "#000000"
        });
        linesArray.push({
            x1: (vbX2 * scale),
            y1: (vbY1 * scale),
            x2: (vbX2 * scale),
            y2: (vbY2 * scale),
            stroke: "#000000"
        });
    }

    renderViewBox()

    // Render each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const x1 = ((+line.getAttribute("x1") / vbXRange));
        const y1 = ((+line.getAttribute("y1") / vbYRange));
        const x2 = ((+line.getAttribute("x2") / vbXRange));
        const y2 = ((+line.getAttribute("y2") / vbYRange));

        // I want to center the whole thing

        const stroke = line.getAttribute("stroke")
        const newLine = {
            x1: x1,
            y1: -y1,
            x2: x2,
            y2: -y2,
            stroke: stroke
        }
        // linesArray.push(newLine);
    }

    // Render each line
    renderLines(gl, program);
  };
  reader.readAsText(event.target.files[0]);
}

function renderLines(gl, program) {
    gl.clear(gl.COLOR_BUFFER_BIT)
    const uZoom = gl.getUniformLocation(program, 'uZoom');
    gl.uniform1f(uZoom, zoom)
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
