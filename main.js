function main()
{
    // Retrieve <canvas> element
    let canvas = document.getElementById('webgl');

    // Get the rendering context for WebGL
    gl = WebGLUtils.setupWebGL(canvas, undefined);
    
    //Check that the return value is not null.
    if (!gl)
    {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Initialize shaders
    program = initShaders(gl, "vshader", "fshader");
    gl.useProgram(program);

    //Set up the viewport
    gl.viewport( 0, 0, 400, 400);

    document.getElementById('files').addEventListener('change', (e) => loadSVG(e, canvas, gl, program), false);
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
    
    // Render each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const x1 = (+line.getAttribute("x1") - vbX1) / vbXRange;
        const y1 = (+line.getAttribute("y1") - vbY1) / vbYRange;
        const x2 = (+line.getAttribute("x2") - vbX1) / vbXRange;
        const y2 = (+line.getAttribute("y2") - vbY1) / vbYRange;
        const stroke = line.getAttribute("stroke")
        const newLine = {
            x1: x1,
            y1: -y1,
            x2: x2,
            y2: -y2,
            stroke: stroke
        }
        // if (i === 0) {
        //     console.log(vbX1, vbY1, vbX2, vbY2)
        //     console.log(vbXRange, vbYRange)
        //     console.log(newLine)
        //     console.log( +line.getAttribute("x1"),  +line.getAttribute("x2"), +line.getAttribute("y1"), +line.getAttribute("y2"))
        // }
        renderLine(gl, program, newLine);
    }
  };
  reader.readAsText(event.target.files[0]);
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
    console.log(strokeRGB)
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
