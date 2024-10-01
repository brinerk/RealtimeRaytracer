#include <raylib.h>
#include <rlgl.h>
#include <raymath.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#define WIDTH_INTERNAL 1920
#define HEIGHT_INTERNAL 1080
#define WIDTH 1920
#define HEIGHT 1080

typedef struct rayCam {
	Vector3 position;
	float fovy;
	float rotation;
	float rotationY;
} rayCam;

typedef struct Sphere {
	Vector3 position;
	float radius;
	Color color;
}Sphere;

typedef struct VertexData {
	Vector3 position;
} VertexData;


int main(void) {
	//set up the window
	InitWindow(WIDTH, HEIGHT, "Raytracer");
	SetTargetFPS(60);
	SetConfigFlags(FLAG_MSAA_4X_HINT);
	SetExitKey(KEY_Q);

	//get shader and render target ready
	Shader shader = LoadShader(NULL, "shaders/ray.frag");
	RenderTexture2D target = LoadRenderTexture(WIDTH_INTERNAL, HEIGHT_INTERNAL);

	//load a model and get the verts
	Model grave = LoadModel("obj/grave_B.obj");
	Mesh graveMesh = grave.meshes[0];
	float* graveVerts = graveMesh.vertices;
	int vertCount = graveMesh.vertexCount;

	//dynamically allocate our array
	VertexData* vertices = (VertexData*)calloc(vertCount/3,sizeof(VertexData));


	//setup an ssbo
	unsigned int ssbo = rlLoadShaderBuffer(sizeof(VertexData)*(vertCount/3), NULL, RL_DYNAMIC_COPY);
	rlBindShaderBuffer(ssbo, 0);
	
	//turn our list of points into verts
	int vi=0;
	for(int v=0;v<vertCount;v+=3){
		vertices[vi] = (VertexData){(Vector3){graveVerts[v],graveVerts[v+1], graveVerts[v+2]}};
		vi++;
	}

	//update our ssbo with our vert array
	rlUpdateShaderBuffer(ssbo,vertices,sizeof(VertexData)*(vertCount/3),0);

	printf("%f,%f,%f\n", vertices[0].position.x, vertices[0].position.y, vertices[0].position.z);

	int resolutionLoc = GetShaderLocation(shader, "resolution");
	int sphereLoc = GetShaderLocation(shader, "sphere_pos");
	int radiiLoc = GetShaderLocation(shader, "radii");
	int cameraLoc = GetShaderLocation(shader, "camera_pos");
	int timeLoc = GetShaderLocation(shader, "u_time");
	int reflectiveLoc = GetShaderLocation(shader, "reflective");
	int rotationLoc = GetShaderLocation(shader, "rotation");
	int rotationYLoc = GetShaderLocation(shader, "rotationY");
	int flashlightLoc = GetShaderLocation(shader, "flashLight");

	Vector2 resolution = {WIDTH_INTERNAL, HEIGHT_INTERNAL};

	//set up camera
	rayCam camera = {{0.0,0.0,0.0}, 90.0, 0.0, 0.0};

	//Create a sphere to draw
	//Sphere sphere = {{0.0,0.0,-10.0}, 4.0, BLUE};
	Vector3 spheres[3] = {{0.0,0.0,-10.0},
						 {0.0,-2005.0,-15.0},
						 {10.0,0.0,-13.0}};

	float radii[3] = {4.,2000.,6.};
	float reflective[3] = {.3,0,0};

	HideCursor();

	float flashlight = 10;

	while(!WindowShouldClose()) {

		float timeValue = GetTime();

		Vector2 mouseDelta = GetMouseDelta();

		SetMousePosition(WIDTH/2, HEIGHT/2);

		float forwardZ = -sin(camera.rotation);
		float forwardX = cos(camera.rotation);

		if(IsKeyDown(KEY_D)) {
			camera.position.x += forwardX * .2;
			camera.position.z -= forwardZ * .2;
		}
		if(IsKeyDown(KEY_A)) {
			camera.position.x -= forwardX * .2;
			camera.position.z += forwardZ * .2;
		}
		if(IsKeyDown(KEY_W)) {
			camera.position.x -= forwardZ * .2;
			camera.position.z -= forwardX * .2;  
		}
		if(IsKeyDown(KEY_S)) {
			camera.position.x += forwardZ * .2;
			camera.position.z += forwardX * .2;  
		}
		if(IsKeyDown(KEY_SPACE)) {
			camera.position.y += 1;
		}
		if(IsKeyDown(KEY_H)) {
			camera.position.y -= 1;
		}
		if(IsKeyPressed(KEY_F)) {
			if(flashlight == 0) {
				flashlight = 10.;
			} else {
				flashlight = 0.;
			}
		}

		camera.rotation += mouseDelta.x * 0.005f;
		camera.rotationY += mouseDelta.y * 0.005f;

		SetShaderValue(shader, resolutionLoc, &resolution, SHADER_UNIFORM_VEC2);
		SetShaderValueV(shader, sphereLoc, &spheres, SHADER_UNIFORM_VEC3,3);
		SetShaderValueV(shader, radiiLoc, &radii, SHADER_UNIFORM_FLOAT,3);
		SetShaderValueV(shader, reflectiveLoc, &reflective, SHADER_UNIFORM_FLOAT,3);
		SetShaderValue(shader, cameraLoc, &camera.position, SHADER_UNIFORM_VEC3);
		SetShaderValue(shader, timeLoc, &timeValue, SHADER_UNIFORM_FLOAT);
		SetShaderValue(shader, rotationYLoc, &camera.rotationY, SHADER_UNIFORM_FLOAT);
		SetShaderValue(shader, rotationLoc, &camera.rotation, SHADER_UNIFORM_FLOAT);
		SetShaderValue(shader, flashlightLoc, &flashlight, SHADER_UNIFORM_FLOAT);

		BeginDrawing();
		ClearBackground(BLACK);
		BeginShaderMode(shader);
		DrawTextureEx(target.texture, (Vector2){0.0f,0.0f}, 0.0f, 1.0f, WHITE);
		EndShaderMode();
		DrawFPS(0,0);
		EndDrawing();
	}

	free(vertices);

	UnloadShader(shader);
	UnloadModel(grave);
	rlUnloadShaderBuffer(ssbo);
	CloseWindow();
	printf("ProgramExiting");
	return 0;
}
