
"use strict"

//--------------------------------------------------------------------------------------------------------
// TERRAIN
//--------------------------------------------------------------------------------------------------------
var vertexShaderTerrain =
`#version 300 es

vec3 calculateNormal(vec3 position, sampler2D heightmap, float height, float width)
{
    vec3 off = vec3(1.0/(width-1.0), 1.0/(height-1.0), 0.0);
    float hL = texture(heightmap, position.xz - off.xz).r;
    float hR = texture(heightmap, position.xz + off.xz).r;
    float hD = texture(heightmap, position.xz - off.zy).r;
    float hU = texture(heightmap, position.xz + off.zy).r;

    return normalize(vec3(hL-hR, 2.0, hD-hU));
}


// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat3 uNormalMatrix;
uniform float uHeight;
uniform float uWidth;

// - texture
uniform sampler2D uSampler;

// INPUT
layout(location=1) in vec2 position_in;

// OUTPUT
out vec2 v_textureCoord;
out vec3 v_pos;
out vec3 v_nor;

// MAIN PROGRAM
void main()
{	
    v_textureCoord = position_in;

	vec3 position = vec3(2.0*position_in.x-1.0, 0.0, 2.0*position_in.y-1.0);
	float terrainHeight = texture(uSampler, position_in).r;
	position.y += terrainHeight;

	vec3 normal = calculateNormal(position, uSampler, uHeight, uWidth);

    v_pos = (uViewMatrix * vec4(position, 1.0)).xyz;
    v_nor = normalize(uNormalMatrix * normal);
	


	gl_Position = uProjectionMatrix * uViewMatrix * vec4(position, 1.0);
}
`;

var fragmentShaderTerrain =
`#version 300 es
precision highp float;

#define M_PI 3.14159265358979

// INPUT
in vec2 v_textureCoord;
in vec3 v_pos;
in vec3 v_nor;

// OUTPUT
out vec4 oFragmentColor;

// UNIFORM
// - color
uniform vec3 uMeshColor;

// - light information
uniform float uLightIntensity;
uniform vec3 uLightPosition;

// - texture
uniform sampler2D uSampler;

void main()
{
    vec3 p = v_pos;
    vec3 n = normalize(v_nor);

    vec3 Ka = uMeshColor.rgb;
    Ka = vec3(0.0, 0.0, 0.0)/255.0;
    vec3 Kd = vec3(252.0, 186.0, 3.0)/255.0;

    vec3 Ia = uLightIntensity * Ka;

    vec3 lightDir = uLightPosition - p;
    float d2 = dot(lightDir, lightDir);
    lightDir /= sqrt(d2);
    float diffuse = max(0.0, dot(n, lightDir));
    vec3 Id = (uLightIntensity / d2) * Kd * vec3(diffuse);
    Id /= M_PI;

	vec4 textureColor = texture(uSampler, v_textureCoord);

    oFragmentColor =  vec4((0.5 * Ia) + (0.5 * Id), 1.0);
    // oFragmentColor = vec4(Id, 1.0);
    // oFragmentColor =  vec4((0.5 * Ia) * (0.5 * Id), 1.0);
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
	vec3 position = vec3(position_in.x, 0.45, position_in.y);
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
// SKY
//--------------------------------------------------------------------------------------------------------
var vertexShaderSky =
`#version 300 es
precision highp float;

layout(location=0) in vec3 position_in;
uniform mat4 uvpmat;
out vec3 v_position;

void main()
{
    v_position = position_in;
    gl_Position = uvpmat * vec4(position_in, 1);
}
`;

var fragmentShaderSky = 
`#version 300 es
precision highp float;

uniform samplerCube tu;

in vec3 v_position;

out vec4 oFragmentColor;

void main()
{
    oFragmentColor = texture(tu, v_position);
}
`;


//--------------------------------------------------------------------------------------------------------
// Global variables
//--------------------------------------------------------------------------------------------------------
var shaderProgramTerrain = null;
var shaderProgramWater = null;
var shaderProgramSky = null;

var vaoTerrain = null;
var vaoWater = null;

var texture = null;

var cube_rend;
var skybox = null;


// Terrain
var jMax = 100;
var iMax = 100;
var nbMeshIndices = 0;


//--------------------------------------------------------------------------------------------------------
// Calculate normals
//--------------------------------------------------------------------------------------------------------
function calculateNormals(vs, ind)
{
    const
      x = 0,
      y = 1,
      z = 2,
      ns = [];

    // For each vertex, initialize normal x, normal y, normal z
    for (let i = 0; i < vs.length; i += 3) {
      ns[i + x] = 0.0;
      ns[i + y] = 0.0;
      ns[i + z] = 0.0;
    }

    // We work on triads of vertices to calculate
    for (let i = 0; i < ind.length; i += 3) {
      // Normals so i = i+3 (i = indices index)
      const v1 = [], v2 = [], normal = [];

      // p2 - p1
      v1[x] = vs[3 * ind[i + 2] + x] - vs[3 * ind[i + 1] + x];
      v1[y] = vs[3 * ind[i + 2] + y] - vs[3 * ind[i + 1] + y];
      v1[z] = vs[3 * ind[i + 2] + z] - vs[3 * ind[i + 1] + z];

      // p0 - p1
      v2[x] = vs[3 * ind[i] + x] - vs[3 * ind[i + 1] + x];
      v2[y] = vs[3 * ind[i] + y] - vs[3 * ind[i + 1] + y];
      v2[z] = vs[3 * ind[i] + z] - vs[3 * ind[i + 1] + z];

      // Cross product by Sarrus Rule
      normal[x] = v1[y] * v2[z] - v1[z] * v2[y];
      normal[y] = v1[z] * v2[x] - v1[x] * v2[z];
      normal[z] = v1[x] * v2[y] - v1[y] * v2[x];

      // Update the normals of that triangle: sum of vectors
      for (let j = 0; j < 3; j++) {
        ns[3 * ind[i + j] + x] = ns[3 * ind[i + j] + x] + normal[x];
        ns[3 * ind[i + j] + y] = ns[3 * ind[i + j] + y] + normal[y];
        ns[3 * ind[i + j] + z] = ns[3 * ind[i + j] + z] + normal[z];
      }
    }

    // Normalize the result.
    // The increment here is because each vertex occurs.
    for (let i = 0; i < vs.length; i += 3) {
      // With an offset of 3 in the array (due to x, y, z contiguous values)
      const nn = [];
      nn[x] = ns[i + x];
      nn[y] = ns[i + y];
      nn[z] = ns[i + z];

      let len = Math.sqrt((nn[x] * nn[x]) + (nn[y] * nn[y]) + (nn[z] * nn[z]));
      if (len === 0) len = 1.0;

      nn[x] = nn[x] / len;
      nn[y] = nn[y] / len;
      nn[z] = nn[z] / len;

      ns[i + x] = nn[x];
      ns[i + y] = nn[y];
      ns[i + z] = nn[z];
    }

    return ns;
  }

//--------------------------------------------------------------------------------------------------------
// Build mesh
//--------------------------------------------------------------------------------------------------------


function buildTerrain()
{
	gl.deleteVertexArray(vaoTerrain);
	let data_positions = new Float32Array(iMax * jMax * 3);
	for (let j = 0; j < jMax; j++)
	{
	    for (let i = 0; i < iMax; i++)
	    {
			// x
			data_positions[2 * (i + j * iMax)] = i / (iMax - 1);
            // z
            data_positions[2 * (i + j * iMax) + 1] = j / (jMax - 1);
	    }
	}

    let nbMeshQuads = (iMax - 1) * (jMax - 1);
	let nbMeshTriangles = 2 * nbMeshQuads;
	nbMeshIndices = 3 * nbMeshTriangles;
	let current_quad = 0;
	let data_indices = new Uint32Array(nbMeshIndices);
	for (let j = 0; j < jMax - 1; j++)
	{
	    for (let i = 0; i < iMax - 1; i++)
	    {
		   	// triangle 1
			data_indices[6 * current_quad] = i + j * iMax;
			data_indices[6 * current_quad + 1] = (i + 1) + j * iMax;
			data_indices[6 * current_quad + 2] = i + (j + 1) * iMax;
			// triangle 2
			data_indices[6 * current_quad + 3] = i + (j + 1) * iMax;
			data_indices[6 * current_quad + 4] = (i + 1) + j * iMax;
			data_indices[6 * current_quad + 5] = (i + 1) + (j + 1) * iMax;
			current_quad++;
	    }
	}

    let data_normals = new Float32Array(nbMeshIndices);
    let data_normals1 = calculateNormals(data_positions, data_indices);
    data_normals = calculateNormals(data_positions, data_indices);
    console.log(data_normals.length + ',' + data_normals1.length)
    console.log(data_normals[0] + ',' + data_normals[1] + ',' + data_normals[2])

    
	// - create a VBO (kind of memory pointer or handle on GPU)
	let vbo_positions_t = gl.createBuffer();
	// - bind "current" VBO
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_t); 
	// - allocate memory on GPU (size of data) and send data from CPU to GPU
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	// - reset GL state
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

    let vbo_normals = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_normals);
    gl.bufferData(gl.ARRAY_BUFFER, data_normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
	
	// Create ande initialize an element buffer object (EBO) [it is a buffer of generic user data: positions, normals, texture coordinates, temperature, etc...]
	// - create data on CPU
	// - this is the geometry of your object)
	// - we store 2D position "indices" as 1D array of "triangle" indices : (i0,j0,k0, i1,j1,k1, i2,j2,k2, ...)
	
	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data_indices, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	

    vaoTerrain = gl.createVertexArray();
	gl.bindVertexArray(vaoTerrain);
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_t);
	let vertexAttributeID = 1; // specifies the "index" of the generic vertex attribute to be modified
	let dataSize = 2; // 2 for 2D positions. Specifies the number of components per generic vertex attribute. Must be 1, 2, 3, 4.
	let dataType = gl.FLOAT; // data type
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType, false, 0, 0); // unused parameters for the moment (normalized, stride, pointer)
    gl.enableVertexAttribArray(vertexAttributeID);

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo_normals);
    vertexAttributeID = 2;
    dataSize = 3;
    dataType = gl.FLOAT;
    gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType, false, 0, 0);
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
	data_positions[0] = -1;
	data_positions[1] = -1;
	data_positions[2] = 1;
	data_positions[3] = -1;
	data_positions[4] = 1;
	data_positions[5] = 1;
	data_positions[6] = -1;
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
	let data_indices = new Uint32Array(6)
	data_indices[0] = 0;
	data_indices[1] = 1;
	data_indices[2] = 3;
	data_indices[3] = 1;
	data_indices[4] = 2;
	data_indices[5] = 3;
	
	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data_indices, gl.STATIC_DRAW);
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
    shaderProgramSky = ShaderProgram(vertexShaderSky, fragmentShaderSky, 'skybox shader');

	// Build mesh
	buildTerrain();
	buildWater();
	
	// TEXTURE
	texture = gl.createTexture();
	const terrain_image = new Image();
    terrain_image.src = 'textures/heightmap2.png';
    terrain_image.onload = () => {
	    
		// Bind texture as the "current" one
		// - each followinf GL call will affect its internal state
        gl.bindTexture(gl.TEXTURE_2D, texture);
		
		// Configure data type (storage on GPU) and upload image data to GPU
		// - RGBA: 4 comonents
		// - UNSIGNED_BYTE: each component is an "unsigned char" (i.e. value in [0;255]) => NOTE: on GPU data is automatically accessed with float type in [0;1] by default
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, terrain_image);
		
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

    //SKYBOX
    skybox = TextureCubeMap();
    skybox.load(["textures/skybox/skybox2/right.png", "textures/skybox/skybox2/left.png",
                "textures/skybox/skybox2/top.png", "textures/skybox/skybox2/bottom.png",
                "textures/skybox/skybox2/back.png", "textures/skybox/skybox2/front.png"])
	let cube = Mesh.Cube()
    cube_rend = cube.renderer(0, -1, -1)

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
{


	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


    /////////////////////////////////////////////
    shaderProgramSky.bind(); // SKY /////////////
    /////////////////////////////////////////////

    Uniforms.uvpmat = ewgl.scene_camera.get_matrix_for_skybox()
    Uniforms.tu = skybox.bind() 
    
    cube_rend.draw(gl.TRIANGLES)

    

    /////////////////////////////////////////////
	shaderProgramWater.bind(); // WATER /////////
    /////////////////////////////////////////////

	var pMat = ewgl.scene_camera.get_projection_matrix();
	var vMat = ewgl.scene_camera.get_view_matrix();
    var mMat = Matrix.scale(1.0);

	Uniforms.uProjectionMatrix = pMat;
	Uniforms.uViewMatrix = vMat;

	gl.bindVertexArray(vaoWater);
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);

    
    /////////////////////////////////////////////
	shaderProgramTerrain.bind(); // TERRAIN /////
    /////////////////////////////////////////////

    
	Uniforms.uMeshColor = [230/255, 66/255, 16/255];
	Uniforms.uProjectionMatrix = pMat;
	Uniforms.uViewMatrix = vMat;
    let nvm = Matrix.mult(vMat, mMat);
    Uniforms.uNormalMatrix = nvm.inverse3transpose();
    Uniforms.uLightIntensity = 50.0;
    Uniforms.uLightPosition = [1.0,1.0,1.0];
	Uniforms.uHeight = jMax;
	Uniforms.uWidth = iMax;
	

  	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture);

	Uniforms.uSampler = 0;

	gl.bindVertexArray(vaoTerrain);
	gl.drawElements(gl.TRIANGLES, nbMeshIndices, gl.UNSIGNED_INT, 0);
    
	
	gl.bindVertexArray(null);
	gl.useProgram(null);
}

//--------------------------------------------------------------------------------------------------------
// => Sylvain's API - call window creation with your customized "init_wgl()" and "draw_wgl()" functions
//--------------------------------------------------------------------------------------------------------
ewgl.launch_3d();
