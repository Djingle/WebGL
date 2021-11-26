
"use strict"

//--------------------------------------------------------------------------------------------------------
// TERRAIN
//--------------------------------------------------------------------------------------------------------
var vertexShaderTerrain =
`#version 300 es

// INPUT
layout(location = 1) in vec2 position_in;

// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
// - texture
uniform sampler2D uSampler;

// OUTPUT
out vec2 v_textureCoord;

// FUNCTIONS
// - one can define function
// - here, is it a noise function that create random values in [-1.0;1.0] given a position in [0.0;1.0]
float noise(vec2 st)
{
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

// MAIN PROGRAM
void main()
{	
	vec2 uv = position_in;
	v_textureCoord = uv;
	
	vec3 position = vec3(2.0 * position_in - 1.0, 0.0);
	
	float terrainHeight = texture(uSampler, uv).r;
	position.z += terrainHeight;
	// add turbulence in height
	// float turbulence = noise(position_in);
	// position.z += terrainHeight + turbulence / 4.0; // tune the height of turbulence
	
	// - write position
	gl_Position = uProjectionMatrix * uViewMatrix * vec4(position, 1.0);
}
`;

var fragmentShaderTerrain =
`#version 300 es
precision highp float;

// INPUT
in vec2 v_textureCoord;

// OUTPUT
out vec4 oFragmentColor;

// UNIFORM
uniform vec3 uMeshColor;
// - texture
uniform sampler2D uSampler;

// MAIN PROGRAM
void main()
{
	vec4 textureColor = texture(uSampler, v_textureCoord);

	// MANDATORY
	// - a fragment shader MUST write an RGBA color
	oFragmentColor = vec4(uMeshColor * textureColor.rgb, 1.0); // [values are between 0.0 and 1.0]
}
`;


//--------------------------------------------------------------------------------------------------------
// WATER
//--------------------------------------------------------------------------------------------------------
var vertexShaderWater =
`#version 300 es
precision highp float;

// INPUT
layout(location = 0) in vec2 position_in;

// OUTPUT

// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;


void main()
{
	vec3 position = vec3(position_in, 100);
	gl_Position = uProjectionMatrix * uViewMatrix * vec4(position, 1.0);
}
`;

var fragmentShaderWater =
`#version 300 es
precision highp float;



out vec4 oFragmentColor;

void main()
{
	oFragmentColor = vec4(66, 16, 230, 1.0);
}
`;

//--------------------------------------------------------------------------------------------------------
// Global variables
//--------------------------------------------------------------------------------------------------------
var shaderProgramTerrain = null;
var shaderProgramWater = null;
var vaoTerrain = null;
var vaoWater = null;
var texture = null;


// Terrain
var jMax = 100;
var iMax = 100;
var nbMeshIndices = 0;

//--------------------------------------------------------------------------------------------------------
// Build mesh
//--------------------------------------------------------------------------------------------------------


function buildTerrain()
{
	gl.deleteVertexArray(vaoTerrain);

	// Create ande initialize a vertex buffer object (VBO) [it is a buffer of generic user data: positions, normals, texture coordinates, temperature, etc...]
	// - create data on CPU
	// - this is the geometry of your object)
	// - we store 2D positions as 1D array : (x0,y0,x1,y1,x2,y2,x3,y3)
	// - for a terrain: a grid of 2D points in [0.0;1.0]
	let data_positions = new Float32Array(iMax * jMax * 2);
	for (let j = 0; j < jMax; j++)
	{
	    for (let i = 0; i < iMax; i++)
	    {
			// x
			data_positions[2 * (i + j * iMax)] = i / (iMax - 1);
			// y
			data_positions[2 * (i + j * iMax) + 1] = j / (jMax - 1);
	    }
	}
	// - create a VBO (kind of memory pointer or handle on GPU)
	let vbo_positions_t = gl.createBuffer();
	// - bind "current" VBO
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_t); 
	// - allocate memory on GPU (size of data) and send data from CPU to GPU
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	// - reset GL state
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	
	// Create ande initialize an element buffer object (EBO) [it is a buffer of generic user data: positions, normals, texture coordinates, temperature, etc...]
	// - create data on CPU
	// - this is the geometry of your object)
	// - we store 2D position "indices" as 1D array of "triangle" indices : (i0,j0,k0, i1,j1,k1, i2,j2,k2, ...)
	let nbMeshQuads = (iMax - 1) * (jMax - 1);
	let nbMeshTriangles = 2 * nbMeshQuads;
	nbMeshIndices = 3 * nbMeshTriangles;
	let ebo_data = new Uint32Array(nbMeshIndices);
	let current_quad = 0;
	for (let j = 0; j < jMax - 1; j++)
	{
	    for (let i = 0; i < iMax - 1; i++)
	    {
		   	// triangle 1
			ebo_data[6 * current_quad] = i + j * iMax;
			ebo_data[6 * current_quad + 1] = (i + 1) + j * iMax;
			ebo_data[6 * current_quad + 2] = i + (j + 1) * iMax;
			// triangle 2
			ebo_data[6 * current_quad + 3] = i + (j + 1) * iMax;
			ebo_data[6 * current_quad + 4] = (i + 1) + j * iMax;
			ebo_data[6 * current_quad + 5] = (i + 1) + (j + 1) * iMax;
			current_quad++;
	    }
	}
	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ebo_data, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	// Create ande initialize a vertex array object (VAO) [it is a "container" of vertex buffer objects (VBO)]
	vaoTerrain = gl.createVertexArray();
	// - bind "current" VAO
	gl.bindVertexArray(vaoTerrain);
	// - bind "current" VBO
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_t);
	// - attach VBO to VAO
	let vertexAttributeID = 1; // specifies the "index" of the generic vertex attribute to be modified
	let dataSize = 2; // 2 for 2D positions. Specifies the number of components per generic vertex attribute. Must be 1, 2, 3, 4.
	let dataType = gl.FLOAT; // data type
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType, false, 0, 0); // unused parameters for the moment (normalized, stride, pointer)
	// - enable the use of VBO. It enable or disable a generic vertex attribute array
	gl.enableVertexAttribArray(vertexAttributeID);
	// - bind "current" EBO
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	
	// Reset GL states
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null); // BEWARE: only unbind the VBO after unbinding the VAO !
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // BEWARE: only unbind the EBO after unbinding the VAO !

	// HACK...
	update_wgl();
}

function buildWater()
{
	gl.deleteVertexArray(vaoWater);

	// Create ande initialize a vertex buffer object (VBO) [it is a buffer of generic user data: positions, normals, texture coordinates, temperature, etc...]
	// - create data on CPU
	// - this is the geometry of your object)
	// - we store 2D positions as 1D array : (x0,y0,x1,y1,x2,y2,x3,y3)
	// - for a terrain: a grid of 2D points in [0.0;1.0]
	let data_positions = new Float32Array(8);
	data_positions[0] = 0;
	data_positions[1] = 0;
	data_positions[2] = 1;
	data_positions[3] = 0;
	data_positions[4] = 1;
	data_positions[5] = 1;
	data_positions[6] = 0;
	data_positions[7] = 1;
	
	// - create a VBO (kind of memory pointer or handle on GPU)
	let vbo_positions_w = gl.createBuffer();
	// - bind "current" VBO
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_w); 
	// - allocate memory on GPU (size of data) and send data from CPU to GPU
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	// - reset GL state
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	
	// Create ande initialize an element buffer object (EBO) [it is a buffer of generic user data: positions, normals, texture coordinates, temperature, etc...]
	// - create data on CPU
	// - this is the geometry of your object)
	// - we store 2D position "indices" as 1D array of "triangle" indices : (i0,j0,k0, i1,j1,k1, i2,j2,k2, ...)
	let ebo_data = new Float32Array(6)
	ebo_data[0] = 0;
	ebo_data[1] = 1;
	ebo_data[2] = 3;
	ebo_data[3] = 1;
	ebo_data[4] = 2;
	ebo_data[5] = 3;
	
	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ebo_data, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	// Create and initialize a vertex array object (VAO) [it is a "container" of vertex buffer objects (VBO)]
	vaoWater = gl.createVertexArray();
	// - bind "current" VAO
	gl.bindVertexArray(vaoWater);
	// - bind "current" VBO
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_w);
	// - attach VBO to VAO
	let vertexAttributeID = 0; // specifies the "index" of the generic vertex attribute to be modified
	let dataSize = 2; // 2 for 2D positions. Specifies the number of components per generic vertex attribute. Must be 1, 2, 3, 4.
	let dataType = gl.FLOAT; // data type
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType, false, 0, 0); // unused parameters for the moment (normalized, stride, pointer)
	// - enable the use of VBO. It enable or disable a generic vertex attribute array
	gl.enableVertexAttribArray(vertexAttributeID);
	// - bind "current" EBO
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	
	// Reset GL states
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null); // BEWARE: only unbind the VBO after unbinding the VAO !
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // BEWARE: only unbind the EBO after unbinding the VAO !

	// HACK...
	update_wgl();
}

//--------------------------------------------------------------------------------------------------------
// Initialize graphics objects and GL states
//--------------------------------------------------------------------------------------------------------
function init_wgl()
{
	// ANIMATIONS // [=> Sylvain's API]
	ewgl.continuous_update = true;
	
	// Create and initialize a shader program // [=> Sylvain's API - wrapper of GL code]
	shaderProgramTerrain = ShaderProgram(vertexShaderTerrain, fragmentShaderTerrain, 'terrain shader');
	shaderProgramWater = ShaderProgram(vertexShaderWater, fragmentShaderWater, 'water shader');

	// Build mesh
	buildTerrain();
	buildWater();
	
	// TEXTURE
	texture = gl.createTexture();
	const image = new Image();
    image.src = 'textures/heightmap.png';
    image.onload = () => {
	    
		// Bind texture as the "current" one
		// - each followinf GL call will affect its internal state
        gl.bindTexture(gl.TEXTURE_2D, texture);
		
		// Configure data type (storage on GPU) and upload image data to GPU
		// - RGBA: 4 comonents
		// - UNSIGNED_BYTE: each component is an "unsigned char" (i.e. value in [0;255]) => NOTE: on GPU data is automatically accessed with float type in [0;1] by default
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
		
		// Configure "filtering" mode
		// => what to do when, projected on screen, a texel of an image is smaller than a screen pixel or when a texel covers several screen pixel
		// => example: when a texture is mapped onto a terrain in the far distance, or when you zoom a lot
		// NEAREST: fast but low quality (neearest texel is used)
		//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		// LINEAR: slower but better quality => take 4 neighboring pixels and compute the mean value
		//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		//gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		// MIPMAPPING: build a pyramid of level of details from imaghe size to 1 pixel, duviding each image size by 2
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
		gl.generateMipmap(gl.TEXTURE_2D); // => build the pyramid of textrues automatically
		
		// Configure wrapping behavior: what to do when texture coordinates exceed [0;1]
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);	
		
		// Clean GL state
        gl.bindTexture(gl.TEXTURE_2D, null);
    };
	
	// Set default GL states
	// - color to use when refreshing screen
	gl.clearColor(0, 0, 0 ,1); // black opaque [values are between 0.0 and 1.0]
	// - enable depth buffer
	gl.enable(gl.DEPTH_TEST);
}

//--------------------------------------------------------------------------------------------------------
// Render scene
//--------------------------------------------------------------------------------------------------------
function draw_wgl()
{	// --------------------------------
	// [1] - always do that
	// --------------------------------
	
	// Clear the GL "color" and "depth" framebuffers (with OR)
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// --------------------------------
	// [2] - render your scene
	// --------------------------------
	var pMat = ewgl.scene_camera.get_projection_matrix();
	var vMat = ewgl.scene_camera.get_view_matrix();


	shaderProgramWater.bind();

	Uniforms.uProjectionMatrix = pMat;
	Uniforms.uViewMatrix = vMat;

	gl.bindVertexArray(vaoWater);
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);

    
	// Set "current" shader program
	shaderProgramTerrain.bind(); // [=> Sylvain's API - wrapper of GL code]

	// Set uniforms // [=> Sylvain's API - wrapper of GL code]
	Uniforms.uMeshColor = [230/255, 66/255, 16/255];
	// - transformation matrix
	Uniforms.uProjectionMatrix = pMat;
	Uniforms.uViewMatrix = vMat;
	
	// Activate texture
	// - set GL state
  	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);
	// - set uniform
	Uniforms.uSampler = 0;

	// Bind "current" vertex array (VAO)
	gl.bindVertexArray(vaoTerrain);
	
	// Draw commands
	gl.drawElements(gl.TRIANGLES, nbMeshIndices, gl.UNSIGNED_INT, 0);

	Uniforms.uMeshColor = [1.0, 1.0, 1.0];
    
	
	// Reset GL state(s)
	// - unbind vertex array
	gl.bindVertexArray(null);
	// - unbind shader program
	gl.useProgram(null);
}

//--------------------------------------------------------------------------------------------------------
// => Sylvain's API - call window creation with your customized "init_wgl()" and "draw_wgl()" functions
//--------------------------------------------------------------------------------------------------------
ewgl.launch_3d();
