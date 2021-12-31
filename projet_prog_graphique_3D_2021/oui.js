
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
uniform highp int uForRef;

// - texture
uniform sampler2D uSampler;

// INPUT
layout(location=1) in vec2 position_in;

// OUTPUT
out vec2 v_textureCoord;
out vec3 v_pos;
out vec3 v_nor;
out vec3 m_pos;
out vec3 m_nor;



// MAIN PROGRAM
void main()
{	
    v_textureCoord = position_in;

	vec3 position = vec3(2.0*position_in.x-1.0, 0.0, 2.0*position_in.y-1.0);
	float terrainHeight = texture(uSampler, position_in).r;
	position.y += terrainHeight;

    m_pos = position;

	vec3 normal = calculateNormal(position, uSampler, uHeight, uWidth);
    m_nor = normalize(normal);

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
in vec3 m_pos;
in vec3 m_nor;

// OUTPUT
out vec4 oFragmentColor;

// UNIFORM
// - color
uniform highp int uForRef;
uniform float uWaterHeight;
uniform float uHeight;
uniform float uWidth;

// - light information
uniform vec3 uLightPosition;

// - texture
uniform sampler2D uGrassSampler;

void main()
{
    if (uForRef==1 && m_pos.y<uWaterHeight) discard;
    if (uForRef==2 && m_pos.y>uWaterHeight) discard;

    //vec2 texCoord = v_textureCoord * 6.0;
	vec2 texCoord = mod(v_textureCoord*(uHeight-1.0), 1.0);
	vec4 textureColor = texture(uGrassSampler, texCoord);

	vec3 Kd;
    //vec3 Kd = textureColor.rgb;

	if (texCoord.x>0.95 || texCoord.x<0.05 || texCoord.y<0.05 || texCoord.y>0.95) Kd = vec3(255.0,59.0,216.0)/255.0;
	else Kd = vec3(0, 0, 0);

    vec3 lightDir = uLightPosition - m_pos;
    float d2 = dot(lightDir, lightDir);
    lightDir /= sqrt(d2);
    float diffuse = max(0.0, dot(m_nor, lightDir));
    vec3 Id = 3.0 * Kd * vec3(diffuse);
    Id /= M_PI;

    oFragmentColor =  vec4(Id, 1.0);
    //oFragmentColor = textureColor;
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
// WATER
//--------------------------------------------------------------------------------------------------------
var vertexShaderWater =
`#version 300 es
precision highp float;

// INPUT
layout(location = 0) in vec2 position_in;

// OUTPUT
out vec4 clip_pos;
out vec2 tex_pos;
out vec3 m_pos;
out vec3 v_pos;

// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform float uWaterHeight;

void main()
{
    tex_pos = position_in;
    m_pos = vec3(position_in.x, uWaterHeight, position_in.y);
    v_pos = vec3(uViewMatrix * vec4(m_pos, 1.0));
	clip_pos = uProjectionMatrix * uViewMatrix * vec4(m_pos, 1.0);
    gl_Position = clip_pos;
}
`;

var fragmentShaderWater =
`#version 300 es
precision highp float;

#define M_PI 3.14159265358979


// INPUT
in vec4 clip_pos;
in vec2 tex_pos;
in vec3 m_pos;
in vec3 v_pos;

// OUTPUT
out vec4 oFragmentColor;

// UNIFORM
uniform sampler2D uSamplerReflection;
uniform sampler2D uSamplerRefraction;
uniform sampler2D uSamplerDistortion;
uniform sampler2D uSamplerNormale;
uniform vec3 uCamPos;
uniform vec3 uLightPosition;
uniform float uTime;

void main()
{
    vec3 normale = normalize(vec3(0, 1, 0));
    vec3 viewDir = normalize(uCamPos - m_pos);
    float angle = acos(dot(viewDir, normale))/M_PI;

    vec3 n = texture(uSamplerNormale, tex_pos + uTime/30.0).rgb;
    n.x = (n.x*2.0-1.0);
    n.z = (n.z*2.0-1.0);
    n.y = 10.0;
    n = normalize(n);

    vec2 disto = texture(uSamplerDistortion, tex_pos + uTime/30.0).rg*2.0-1.0;

    vec2 ndc = (clip_pos.xy/clip_pos.w)/2.0 + 0.5;
    ndc += disto/50.0;

    vec2 coord_rac = vec2(ndc.x, ndc.y);
    vec2 coord_lec = vec2(ndc.x, -ndc.y);
	vec4 reflection = texture(uSamplerReflection, coord_lec);
	vec4 refraction = texture(uSamplerRefraction, coord_rac);

    vec3 color = mix(reflection, refraction, 1.0-2.5*angle).rgb;

    vec3 lightDir = normalize(uLightPosition - m_pos);
    vec3 halfDir = normalize(viewDir + lightDir);
    float specularTerm = max(0.0, pow(dot(n, halfDir), 128.0));
    vec3 Is = 1.0 * vec3(specularTerm);
    
    //float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
    oFragmentColor = vec4(Is + color, 1.0);

    //oFragmentColor = vec4(color, 1.0);
}
`;


//--------------------------------------------------------------------------------------------------------
// GUI
//--------------------------------------------------------------------------------------------------------



var vertexShaderUI =
`#version 300 es
precision highp float;

// INPUT
layout(location=0) in vec2 position_in;

// OUTPUT
out vec2 tex_coord;

void main()
{
	tex_coord = position_in;
	gl_Position = vec4(position_in.x, position_in.y, -1.0, 1.0);
}
`;

var fragmentShaderUI = 
`#version 300 es
precision highp float;

// INPUT
in vec2 tex_coord;

// UNIFORM
uniform sampler2D uSampler;

// OUTPUT
out vec4 oFragmentColor;

void main()
{
    // vec2 coord = tex_coord*0.5+0.5;
    // vec4 reflection = texture(uSamplerReflection, coord);
    // vec4 refraction = texture(uSamplerRefraction, coord);
    // oFragmentColor = mix(reflection, refraction, 0.5);
    // //oFragmentColor = refraction;

}
`;


//--------------------------------------------------------------------------------------------------------
// Global variables
//--------------------------------------------------------------------------------------------------------

// Shaders
var shaderProgramTerrain = null;
var shaderProgramWater = null;
var shaderProgramSky = null;
var shaderProgramUI = null;

// VAOS
var vaoTerrain = null;
var vaoWater = null;
var vaoUI = null;

var texture_terrain = null;
var texture_distortion = null;
var texture_grass = null;
var texture_normale = null;

var cube_rend;
var skybox = null;

// FBO for ref.
var fboLec = null;
var fboRac = null;
var texReflection = null;
var texRefraction = null;
var fboTexWidth = 2048;
var fboTexHeight = 2048;


// Terrain
var jMax = 50;
var iMax = 50;
var nbMeshIndices = 0;

// GUI
var checkbox_debug;
var slider_water;




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

    
	let vbo_positions_t = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_t); 
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	

	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data_indices, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
    vaoTerrain = gl.createVertexArray();
	gl.bindVertexArray(vaoTerrain);

	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_t);
	let vertexAttributeID = 1;
	let dataSize = 2;
	let dataType = gl.FLOAT;
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType, false, 0, 0);
    gl.enableVertexAttribArray(vertexAttributeID);

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

	update_wgl();
}

function buildWater()
{
	gl.deleteVertexArray(vaoWater);

	let data_positions = new Float32Array(8);
	data_positions[0] = -1;
	data_positions[1] = -1;
	data_positions[2] = 1;
	data_positions[3] = -1;
	data_positions[4] = 1;
	data_positions[5] = 1;
	data_positions[6] = -1;
	data_positions[7] = 1;
	
	let vbo_positions_w = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_w); 
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	
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
	
	vaoWater = gl.createVertexArray();
	gl.bindVertexArray(vaoWater);
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_w);
	let vertexAttributeID = 0;
	let dataSize = 2;
	let dataType = gl.FLOAT;
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType, false, 0, 0);
	gl.enableVertexAttribArray(vertexAttributeID);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

	update_wgl();
}


function buildUI(width, height)
{
    gl.deleteVertexArray(vaoUI);

    let data_positions = new Float32Array(8);
	data_positions[0] = -1;
	data_positions[1] = -1;
	data_positions[2] = -1;
	data_positions[3] = 1;
	data_positions[4] = 1;
	data_positions[5] = 1;
	data_positions[6] = 1;
	data_positions[7] = -1;
	
	let vbo_positions_w = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_w); 
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	
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
	
	vaoUI = gl.createVertexArray();
	gl.bindVertexArray(vaoUI);
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions_w);
	let vertexAttributeID = 0;
	let dataSize = 2;
	let dataType = gl.FLOAT;
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType, false, 0, 0);
	gl.enableVertexAttribArray(vertexAttributeID);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

	update_wgl();
}

//--------------------------------------------------------------------------------------------------------
// Initialize graphics objects and GL states
//--------------------------------------------------------------------------------------------------------
function init_wgl()
{
	// ANIMATIONS // [=> Sylvain's API]
	ewgl.continuous_update = true;


    UserInterface.begin();

        UserInterface.use_field_set('H', "Debug");
        checkbox_debug = UserInterface.add_check_box('Debug UI', false, update_wgl);
        slider_water = UserInterface.add_slider('Water Height', 0, 50, 20, update_wgl);
        UserInterface.end_use();
    UserInterface.end();
	
	// Create and initialize a shader program // [=> Sylvain's API - wrapper of GL code]
	shaderProgramTerrain = ShaderProgram(vertexShaderTerrain, fragmentShaderTerrain, 'terrain shader');
	shaderProgramWater = ShaderProgram(vertexShaderWater, fragmentShaderWater, 'water shader');
    shaderProgramSky = ShaderProgram(vertexShaderSky, fragmentShaderSky, 'skybox shader');
    shaderProgramUI = ShaderProgram(vertexShaderUI, fragmentShaderUI, 'UI shader', 0, 100, 50, update_wgl);

	// Build mesh
	buildTerrain();
	buildWater();
    buildUI(gl.canvas.width, gl.canvas.height);
	
	// TEXTURE
	texture_terrain = gl.createTexture();
	const terrain_image = new Image();
    terrain_image.src = 'textures/heightmap2.png';
    terrain_image.onload = () => {
	    gl.bindTexture(gl.TEXTURE_2D, texture_terrain);
		
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, terrain_image);
		
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);	
		
        gl.bindTexture(gl.TEXTURE_2D, null);
    };

    texture_grass = gl.createTexture();
    const grass_image = new Image();
    grass_image.src = 'textures/grass.png';
    grass_image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture_grass);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, grass_image);
		
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    texture_distortion = gl.createTexture();
    const distortion_image = new Image();
    distortion_image.src = 'textures/distortion_map.png';
    distortion_image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture_distortion);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, distortion_image);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    texture_normale = gl.createTexture();
    const normale_image = new Image();
    normale_image.src = 'textures/normal_map.png';
    normale_image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D, texture_normale);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, distortion_image);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }


    //SKYBOX
    skybox = TextureCubeMap();
    skybox.load(["textures/skybox/skybox3/right.png", "textures/skybox/skybox3/left.png",
                "textures/skybox/skybox3/top.png", "textures/skybox/skybox3/bottom.png",
                "textures/skybox/skybox3/back.png", "textures/skybox/skybox3/front.png"])
	let cube = Mesh.Cube()
    cube_rend = cube.renderer(0, -1, -1)


	// REFLEXION AND REFRACTION
	//   Textures

	texReflection = gl.createTexture();
	texRefraction = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texReflection);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fboTexWidth, fboTexHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	gl.bindTexture(gl.TEXTURE_2D, texRefraction);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fboTexWidth, fboTexHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

	gl.bindTexture(gl.TEXTURE_2D, null);


	//   FBOs
	fboLec = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fboLec);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texReflection, 0);
	gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

	fboRac = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, fboRac);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texRefraction, 0);
	gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);

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
	/////////////////////////////////////////////
	// FIRST PASS FOR REFLECTION ////////////////
	/////////////////////////////////////////////
    const waterHeight = slider_water.value/50;
    const lightPosition = [10.0, 50.0, -30.0];

	gl.bindFramebuffer(gl.FRAMEBUFFER, fboLec);
	gl.viewport(0, 0, fboTexWidth, fboTexHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	let caminf = ewgl.scene_camera.get_look_info();
	let E = Vec3(caminf[0].xyz);
    E.y = E.y - 2 * (E.y - waterHeight);
	let D = Vec3(caminf[1]);
    D.y = -D.y;
	let U = Vec3(0, 1, 0);
	ewgl.scene_camera.look(E, D, U);

	/////////////////////////////////////////////
    shaderProgramSky.bind(); // SKY /////////////

    Uniforms.uvpmat = ewgl.scene_camera.get_matrix_for_skybox()
    Uniforms.tu = skybox.bind() 
    
    cube_rend.draw(gl.TRIANGLES)

	/////////////////////////////////////////////
	shaderProgramTerrain.bind(); // TERRAIN /////

	var pMat = ewgl.scene_camera.get_projection_matrix();
	var vMat = ewgl.scene_camera.get_view_matrix();
    var mMat = Matrix.scale(1.0);

	Uniforms.uProjectionMatrix = pMat;
	Uniforms.uViewMatrix = vMat;
    let nvm = Matrix.mult(vMat, mMat);
    Uniforms.uNormalMatrix = nvm.inverse3transpose();
    Uniforms.uLightPosition = lightPosition;
	Uniforms.uHeight = jMax;
	Uniforms.uWidth = iMax;
    Uniforms.uForRef = 1;
    Uniforms.uWaterHeight = waterHeight;
	

  	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texture_terrain);
	Uniforms.uSampler = 0;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture_grass);
    Uniforms.uGrassSampler = 1;


	gl.bindVertexArray(vaoTerrain);
	gl.drawElements(gl.TRIANGLES, nbMeshIndices, gl.UNSIGNED_INT, 0);


    /////////////////////////////////////////////
	// SECOND PASS FOR REFRACTION ///////////////
	/////////////////////////////////////////////

    
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboRac);
	gl.viewport(0, 0, fboTexWidth, fboTexHeight);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    ewgl.scene_camera.look(caminf[0], caminf[1], Vec3(0,1,0));
        
    pMat = ewgl.scene_camera.get_projection_matrix();
	vMat = ewgl.scene_camera.get_view_matrix();
    mMat = Matrix.scale(1.0);

	/////////////////////////////////////////////
    shaderProgramSky.bind(); // SKY /////////////

    Uniforms.uvpmat = ewgl.scene_camera.get_matrix_for_skybox()
    Uniforms.tu = skybox.bind() 
    
    cube_rend.draw(gl.TRIANGLES)

	/////////////////////////////////////////////
	shaderProgramTerrain.bind(); // TERRAIN /////

    Uniforms.uProjectionMatrix = pMat;
	Uniforms.uViewMatrix = vMat;
    nvm = Matrix.mult(vMat, mMat);
    Uniforms.uNormalMatrix = nvm.inverse3transpose();
    Uniforms.uForRef = 2;


	gl.bindVertexArray(vaoTerrain);
	gl.drawElements(gl.TRIANGLES, nbMeshIndices, gl.UNSIGNED_INT, 0);

	/////////////////////////////////////////////
	// THIRD PASS FOR REAL RENDERING ////////////
	/////////////////////////////////////////////
    
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	
	/////////////////////////////////////////////
    shaderProgramSky.bind(); // SKY /////////////

    Uniforms.uvpmat = ewgl.scene_camera.get_matrix_for_skybox()
    Uniforms.tu = skybox.bind() 
    
    cube_rend.draw(gl.TRIANGLES)    
    
    /////////////////////////////////////////////
	shaderProgramTerrain.bind(); // TERRAIN /////
	
    Uniforms.uForRef = 0;

	gl.bindVertexArray(vaoTerrain);
	gl.drawElements(gl.TRIANGLES, nbMeshIndices, gl.UNSIGNED_INT, 0);

	/////////////////////////////////////////////
	shaderProgramWater.bind(); // WATER /////////
    /////////////////////////////////////////////

	Uniforms.uProjectionMatrix = pMat;
	Uniforms.uViewMatrix = vMat;
    Uniforms.uWaterHeight = waterHeight;
    Uniforms.uCamPos = Vec3(caminf[0]);
    Uniforms.uTime = ewgl.current_time;
    Uniforms.uLightPosition = lightPosition;

	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, texReflection);
	Uniforms.uSamplerReflection = 0;
	
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, texRefraction);
	Uniforms.uSamplerRefraction = 1;

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texture_distortion);
    Uniforms.uSamplerDistortion = 2;

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, texture_normale);
    Uniforms.uSamplerNormale = 3;

	gl.bindVertexArray(vaoWater);
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);


    if (checkbox_debug.checked)
    {
        /////////////////////////////////////////////
        shaderProgramUI.bind(); // UI ///////////////
        /////////////////////////////////////////////

        gl.viewport(0, 0, gl.canvas.width/3, gl.canvas.height/3);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texReflection);
        Uniforms.uSamplerReflection = 0;
        
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, texRefraction);
        Uniforms.uSamplerRefraction = 1;

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, texture_normale);
        Uniforms.uSamplerNormale = 2;

        gl.bindVertexArray(vaoUI);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
    }
	
	gl.bindVertexArray(null);
	gl.useProgram(null);
}

//--------------------------------------------------------------------------------------------------------
// => Sylvain's API - call window creation with your customized "init_wgl()" and "draw_wgl()" functions
//--------------------------------------------------------------------------------------------------------
ewgl.launch_3d();
