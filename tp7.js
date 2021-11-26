
"use strict"

//--------------------------------------------------------------------------------------------------------
// VERTEX SHADER (GLSL language)
//--------------------------------------------------------------------------------------------------------
var vertexShader =
`#version 300 es

// OUTPUT
// Texture coordinates
out vec2 texCoord;

void main()
{
	// Compute vertex position between [-1;1]
	float x = -1.0 + float((gl_VertexID & 1) << 2); // If VertexID == 1 then x = 3 else x == -1
	float y = -1.0 + float((gl_VertexID & 2) << 1); // If VertexID == 2 then y = 3 else y == -1
	
	// Compute texture coordinates between [0;1] (-1 * 0.5 + 0.5 = 0 and 1 * 0.5 + 0.5 = 1)
	texCoord.x = x * 0.5 + 0.5;
	texCoord.y = y * 0.5 + 0.5;
	
	// Send position to clip space
	gl_Position = vec4(x, y, 0.0, 1.0);
}
`;

//--------------------------------------------------------------------------------------------------------
// FRAGMENT SHADER (GLSL language)
//--------------------------------------------------------------------------------------------------------
var fragmentShader =
`#version 300 es
precision highp float;

#define M_PI 3.14159265358979



// UNIFORM
// Material (BRDF: bidirectional reflectance distribution function)
// uniform vec3 uKd; // diffuse
// Light (Point light)
uniform vec3 pos_lum[500];
uniform vec3 col_lum[500];
uniform int nb_lum;
uniform sampler2D uKd;
uniform sampler2D uPos;
uniform sampler2D uNor;

// INPUT
in vec2 texCoord;

// OUTPUT
out vec4 oFragmentColor;

// MAIN PROGRAM
void main()
{
	// --------------------------------------
	// Lighting and shading: PER-FRAGMENT
	// - here, we "retrieve" mandatory information from the vertex shader (i.e. "position" and "normal")
	// --------------------------------------
	vec3 p = vec3(texture(uPos, texCoord));
	vec3 n = vec3(normalize(texture(uNor, texCoord))); // interpolated normal direction from current interpolated position in View space
	vec3 kd = vec3(texture(uKd, texCoord));

	vec3 color = vec3(0);

	for (int i = 0; i < nb_lum; ++i)
	{
		// Reflected diffuse intensity
		vec3 lightDir = pos_lum[i] - p; // "light direction" from current interpolated position in View space
		float d2 = dot(lightDir, lightDir); // square distance from the light to the fragment
		lightDir /= sqrt(d2); // normalization of light dir -- or : lightDir = normalize(lightDir);
		float diffuseTerm = max(0.0, dot(n, lightDir)); // "max" is used to avoir "back" lighting (when light is behind the object)
		vec3 Id = (col_lum[i] / d2) * 1.0 * vec3(diffuseTerm);
		Id = Id / M_PI; // normalization of the diffuse BRDF (for energy conservation)
		
		// Reflected intensity (i.e final color)
		color += Id;
	}
	// --------------------------------------
	
	oFragmentColor = vec4(color, 1); // [values are between 0.0 and 1.0]
}
`;

var fullscreen_vertexShader =
`#version 300 es
precision highp float;

// INPUT
layout(location=0) in vec3 position_in;
layout(location=1) in vec3 normal_in;
layout(location=2) in vec3 centers_in;

// UNIFORM
// - Camera matrices
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

// OUTPUT
out vec3 v_position;
out vec3 v_normal;

// MAIN PROGRAM
void main()
{
	vec4 view_pos = uViewMatrix * vec4(centers_in + 0.03 * position_in, 1.0);
	v_position = view_pos.xyz; // in View space
	v_normal = (uViewMatrix * vec4(centers_in + 0.03 * normal_in, 0.0)).xyz; // in View space

	gl_Position = uProjectionMatrix * view_pos;
}
`;


var fullscreen_fragmentShader = 
`#version 300 es
precision highp float;


layout (location=0) out vec4 kd;
layout (location=1) out vec4 pos;
layout (location=2) out vec4 nor;

// INPUT
in vec3 v_position;
in vec3 v_normal;

void main()
{
    pos = vec4(v_position, 1.0);
    nor = vec4(v_normal, 1.0);
    kd = vec4(1.0);
}
`;


//--------------------------------------------------------------------------------------------------------
// GLOBAL VARIABLES
//--------------------------------------------------------------------------------------------------------

// Shader program
var shaderProgram = null;
var shaderProgramfs = null;

// GUI (graphical user interface)
var lights_intensity;

// Renderers
var cube_rend = null;

var fbo = null;
var depthRenderBuffer = null;
var kd = null;
var v_pos = null;
var v_nor = null;
var fboTexHeight = 64;
var fboTexWidth = 64;

//
var lightsPos = [];
var lightsColor = [];
var nbLights = 10;
var nbLightsMax = 100;
var nbCubes;

//--------------------------------------------------------------------------------------------------------
// Initialize graphics objects and GL states
//
// Here, we want to load a 3D asset
// Uniforms are used to be able edit GPU data with a customized GUI (graphical user interface)
//--------------------------------------------------------------------------------------------------------
function init_wgl()
{
	// ANIMATIONS // [=> Sylvain's API]
	ewgl.continuous_update = true;
	
	UserInterface.begin(true, true);
		UserInterface.add_slider('nb lights', 1, nbLightsMax, nbLights, x=>{nbLights = x; update_wgl();}, x=> x);
		lights_intensity = UserInterface.add_slider('lights intensity', 1, 50, 10, update_wgl);
		UserInterface.add_button('move lights', update_lights_pos);
		UserInterface.add_button('change lights color', update_lights_color);
	UserInterface.end();
	
	// Create and initialize a shader program // [=> Sylvain's API - wrapper of GL code]
	shaderProgram = ShaderProgram(vertexShader, fragmentShader, 'basic shader');
    shaderProgramfs = ShaderProgram(fullscreen_vertexShader, fullscreen_fragmentShader, 'fullscreen shader');

	// Compute a VBO to send the center of cubes (one position vec3 for each cube)
	var size = 10;	// nb cubes on a line
	nbCubes = size * size * size;	// total cubes

	// Determine the position of all cubes with their center point
	let cubes_centers = new Float32Array(nbCubes * 3);
	for (let i = 0; i < size; ++i)
	{
		for (let j = 0; j < size; ++j)
		{
			for (let k = 0; k < size; ++k)
			{
				let indice = 3 * (k + (j * size) + (i * size * size));
				let x = (2 * k) - (2 * (size / 2));
				let y = (2 * j) - (2 * (size / 2));
				let z = (2 * i) - (2 * (size / 2));
				// x
				cubes_centers[indice] = x / (size - 1);
				// y
				cubes_centers[indice + 1] = y / (size - 1);
				// z
				cubes_centers[indice + 2] = z / (size - 1);
			}
		}
	}
	// Create a VBO containing the 3D postions of the centers of the cubes
	let vbo_pos = VBO(cubes_centers, 3);

	// Create geometry : mesh cube
	let mesh = Mesh.Cube()
	// get the associated instanced renderer with positions(0) and normals(1) VBO + a vbo containing the centers of the cubes(2)
	cube_rend = mesh.instanced_renderer([[2, vbo_pos, 1]], 0, 1, -1);

	// Set the view frustrum
	ewgl.scene_camera.set_scene_radius(mesh.BB.radius);
	ewgl.scene_camera.set_scene_center(mesh.BB.center);

	// Set the lights positions and colors
	for (let i = 0; i < nbLightsMax; i++)
	{
		lightsPos.push(Vec3(getRandomMinMax(-1.0, 1.0), getRandomMinMax(-1.0, 1.0), getRandomMinMax(-1.0, 1.0)));
		lightsColor.push(Vec3(0.2 + Math.random(), 0.2 + Math.random(), 0.3 + Math.random()));
	}


    // TEXTURES
    kd = gl.createTexture();
    v_pos = gl.createTexture();
    v_nor = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, kd);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, fboTexWidth, fboTexHeight, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, v_pos);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, fboTexWidth, fboTexHeight, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, v_nor);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, fboTexWidth, fboTexHeight, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

    gl.bindTexture(gl.TEXTURE_2D, null);

    // FBO
    fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, kd, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, v_pos, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT2, gl.TEXTURE_2D, v_nor, 0);
    
    
    depthRenderBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthRenderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, fboTexWidth, fboTexHeight);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthRenderBuffer);
    
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1, gl.COLOR_ATTACHMENT2]);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    

	// Set default GL states
	// - color to use when refreshing screen
	gl.clearColor(0, 0, 0 , 1); // black opaque [values are between 0.0 and 1.0]
	// - enable "depth test"
	gl.enable(gl.DEPTH_TEST);
}

function getRandomMinMax(min, max)
{
	return Math.random() * (max - min) + min;
}

function update_lights_pos()
{
	for (let i = 0; i < nbLightsMax; i++)
		lightsPos[i] = Vec3(getRandomMinMax(-1.0, 1.0), getRandomMinMax(-1.0, 1.0), getRandomMinMax(-1.0, 1.0));
}

function update_lights_color()
{
	for (let i = 0; i < nbLightsMax; i++)
	lightsColor[i] = Vec3(0.2 + Math.random(),0.2 + Math.random(),0.3 + Math.random());
}

//--------------------------------------------------------------------------------------------------------
// Render scene
//--------------------------------------------------------------------------------------------------------
function draw_wgl() {

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    gl.viewport(0, 0, fboTexWidth, fboTexHeight);

	// Clear the GL "color" and "depth" framebuffers (with OR)
	gl.clear(gl.COLOR_BUFFER_BIT);

    shaderProgramfs.bind();

    Uniforms.uProjectionMatrix = ewgl.scene_camera.get_projection_matrix();
    const viewMatrix = ewgl.scene_camera.get_view_matrix();
	Uniforms.uViewMatrix = viewMatrix;


    cube_rend.draw(gl.TRIANGLES, nbCubes);


    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Set "current" shader program
	shaderProgram.bind(); // [=> Sylvain's API - wrapper of GL code]

	// - camera
	// ---- retrieve current camera matrices ("view" matrix reacts to mouse events)
	//Uniforms.uProjectionMatrix = ewgl.scene_camera.get_projection_matrix();

	// LIGHTS
	let pl =[];
	lightsPos.forEach(l => { pl.push(viewMatrix.transform(l));});
	Uniforms.pos_lum = pl;
	let cl =[];
	lightsColor.forEach(l => { cl.push(l.normalized().scalarmult(lights_intensity.value/100));});
	Uniforms.col_lum = cl  ;
	Uniforms.nb_lum = nbLights;

    gl.activeTexture(gl.TEXTURE0);
    gl.activeTexture(gl.TEXTURE1);
    gl.activeTexture(gl.TEXTURE2);

    Uniforms.uKd = 0;
    Uniforms.uPos = 1;
    Uniforms.uNor = 2;
	
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	// Reset GL state(s)
	// - unbind vertex array
	gl.bindVertexArray(null); // not mandatory. For optimization, could be removed.
	// - unbind shader program
	unbind_shader();
}

//--------------------------------------------------------------------------------------------------------
// => Sylvain's API - call window creation with your customized "init_wgl()" and "draw_wgl()" functions
//--------------------------------------------------------------------------------------------------------
ewgl.launch_3d();
