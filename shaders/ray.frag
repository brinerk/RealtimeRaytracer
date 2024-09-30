#version 330 core

uniform vec2 resolution;

uniform vec3 sphere_pos[3];
uniform vec3 camera_pos;

uniform float radii[3];
uniform float reflective[3];

//uniform float verts[1000];

uniform float u_time;

uniform float rotation;
uniform float rotationY;

uniform float flashLight;


struct Sphere {
	vec3 p;
	vec3 c;
	float r;
	float e;
	float d;
	float spec;
	int i;
};

struct Ray {
	vec3 ro;
	vec3 rd;
	vec3 c;
};

struct Triangle {
	vec3 a;
	vec3 b;
	vec3 c;
	vec3 color;
	float e;
	float spec;
};

struct Object {
	int type;
	Sphere sphere;
	Triangle triangle;
};

Sphere spheres[20];
Triangle _triangles[10];
//vec3 _verts[400];
//Triangle _grave[400];

vec3 color[3] = vec3[3]( 
	vec3(1.0,.6,.3),
	vec3(0.0,.6,.4),
	vec3(.3,.2,.5));

vec3 light_pos = vec3(1.,5.,-8.);

vec3 background_color = vec3(.35,.45,.9);

float rand(vec2 co) {
	return fract(sin(dot(co.xy, vec2(12.9898, 78.233)))*43758.5453123);
}

vec2 rand_norm(vec2 st) {
	float u1 = rand(st);
	float u2 = rand(st*2.);
	float r = sqrt(-2*log(u1));
	float theta  =2.0 * 3.1415 * u2;
	return r * vec2(cos(theta), sin(theta));
}

float intersect_sphere(vec3 O, vec3 D, vec3 sphere_pos, float r) {

	vec3 CO = O - sphere_pos;

	//get ready for quadratic
	float a = dot(D,D);
	float b = 2*dot(CO,D);
	float c = dot(CO, CO) - r*r;

	float discrim = b*b - 4*a*c;

	if (discrim < 0){
		return 1000.;
	}

	//don't need the backside
	//float t1 = (-b + sqrt(discrim))/(2*a);
	float t2 = (-b - sqrt(discrim))/(2*a);
	return t2;

}


//thanks wikipedia
float intersect_triangle(vec3 O, vec3 D, Triangle triangle) {
	vec3 edge1 = triangle.b - triangle.a;
	vec3 edge2 = triangle.c - triangle.a;
	vec3 ray_cross_edge2 = cross(D, edge2);
	float det = dot(edge1, ray_cross_edge2);

	if(det > -0.001 && det < 0.001) return 1000.;

	float inv_det = 1./det;
	vec3 s = O - triangle.a;
	float u = inv_det * dot(s, ray_cross_edge2);

	if(u< 0 || u >1) return 1000.;
	
	vec3 s_cross_e1 = cross(s, edge1);
	float v = inv_det * dot(D, s_cross_e1);

	if(v<0|| u + v >1) return 1000.;
	
	float t = inv_det * dot(edge2,s_cross_e1);
	if(t>.001) {
		return t;
	} else {
		return 1000.;
	}
}

vec3 world_to_canvas(vec2 st, float fov) {
	float aspect_ration = resolution.x / resolution.y;

	float fovy = radians(fov);

	float view_height = 2.0 * tan(fovy /2.);
	float view_width = view_height * aspect_ration;
	
	float px = (st.x - .5) * view_width;
	float py = (st.y - .5) * view_height;
	return normalize(vec3(px, py, -1.));
}

vec3 qtransform(vec4 q, vec3 v) {
	return v + 2.0*cross(cross(v, q.xyz) + q.w*v, q.xyz);
}
vec4 qmul(vec4 l, vec4 r) {
	return vec4(l.w * r.xyz + r.w * l.xyz + cross(l.xyz, r.xyz), l.w * r.w - dot(l.xyz, r.xyz));
}

vec4 trace_ray(vec3 O, vec3 D, int t_min,int t_max, int depth, float rotation, float rotationY, vec2 st) {

	//transform view
	vec4 q = vec4(0., sin(rotation/2), 0., cos(rotation/2));
	vec3 localX = vec3(1., 0., 0.);
	vec3 rotated = qtransform(q, localX);
	vec4 q2 = vec4(rotated * sin(rotationY/2),cos(rotationY/2));
	vec4 q3 = qmul(q, q2);
	D = qtransform(q3, D);

	
	vec3 originalD = D;
	vec3 final_color = vec3(0.);
	int num_samples = 30; 

	for(int samples=0; samples<num_samples; samples++) {
		vec3 incoming = vec3(0.);
		vec3 ray_color = vec3(1.);

		O = camera_pos;
		D = originalD;

		for(int i = 0; i<5; i++) { 	   //MAX BOUNCES OF LIGHT

			float closest_t = 1000.;
			Sphere closest_sphere;
			Object closest_object;
			bool hit = false;

			for(int s = 0; s<20; s++) { //loop over spheres

				float t = intersect_sphere(O, D, spheres[s].p, spheres[s].r);

				if(t>0.001 && t<closest_t) {
					closest_object.type = 0;
					closest_t = t;
					closest_object.sphere = spheres[s];
					hit = true;
				}

			}
			

			for(int tri=0;tri<10;tri++) {

				float t = intersect_triangle(O,D,_triangles[tri]);
				if(t>0.001&&t<closest_t) {
					closest_object.type = 1;
					closest_t = t;
					closest_object.triangle = _triangles[tri];
					hit = true;
				}
			}

			if(hit && closest_object.type == 0) {
				Sphere closest_sphere = closest_object.sphere;
				O = O + D * closest_t;
				vec3 N = normalize(O - closest_sphere.p);
				vec2 gaussian = rand_norm(st*u_time*float(samples+1));
				vec3 rand_unit = normalize(vec3(gaussian,rand(st*3*u_time*float(samples+2))));

				if(closest_sphere.spec < 1) {
					D = reflect(D,N) + (closest_sphere.spec * rand_unit); 
				} else {
					D = rand_unit;
				}
				D = D*sign(dot(D,N));

				vec3 emitted = closest_sphere.e * closest_sphere.c;
				incoming += emitted * ray_color;
				
				//add ambient light (makes it easier to see what's going on)
				//incoming += vec3(.05)*ray_color;
				ray_color *= closest_sphere.c;
			} 
			else if(hit && closest_object.type == 1) {

				Triangle closest_tri = closest_object.triangle;
				O = O + D * closest_t;

				vec3 edge1 = closest_tri.b - closest_tri.a;
				vec3 edge2 = closest_tri.c - closest_tri.a;
				vec3 N = normalize(cross(edge1,edge2));

				vec2 gaussian = rand_norm(st*u_time*float(samples+1));
				vec3 rand_unit = normalize(vec3(gaussian,rand(st*3*u_time*float(samples+2))));

				if(closest_tri.spec < 1) {
					D = reflect(D,N) + (closest_tri.spec * rand_unit); 
				} else {
					D = rand_unit;
				}

				//D = D*sign(dot(D,N));

				vec3 emitted = closest_tri.e * closest_tri.color;
				incoming += emitted * ray_color;
				ray_color *= closest_tri.color;
			} else {
				//incoming += vec3(0.3,.4,.8) * ray_color;
				break;
			}
		}
		final_color += incoming;
	}
	final_color /= num_samples;
	return vec4(final_color,1.);
}

vec4 tone_map(vec4 color) {
	return vec4(color.rgb/ (color.rgb + vec3(1.)),color.a);
}

void main() {


	/*int vp = 0;
	for(int p = 0; p<1000; p+=3) {
		_verts[vp] = vec3(verts[p],verts[p+1],verts[p+2]);
		vp++;
	}
	int t = 0;
	for(int g=0; g<400; g+=3) {
		_grave[t] = Triangle(_verts[g],_verts[g+1],_verts[g+2], vec3(1.,.8,.8), 0, 1);
		t++;
	}*/

	spheres[0] = Sphere(sphere_pos[0], color[0], 6, 0, -10, 1*cos(u_time/10)+1,0);
	spheres[1] = Sphere(sphere_pos[1], color[1], radii[1], 0, .9, 1., 1);
	spheres[2] = Sphere(sphere_pos[2], color[2], radii[2], 0, .9, 1., 2);
	spheres[3] = Sphere(vec3(830.,0.,0.), vec3(1.,.5,.3), 800, 0, .8, 1., 3);
	spheres[4] = Sphere(vec3(0.,0.,820.), vec3(.7,.1,.3), 800, 0, .8, 1., 4);
	spheres[5] = Sphere(vec3(-810.,0.,0.), vec3(.1,.5,.9), 800, 0, .8, 1., 5);
	spheres[6] = Sphere(vec3(0.,0.,-830.), vec3(1,1,1), 800, 0, .8, 1., 6);
	spheres[7] = Sphere(vec3(0.,810.,0.), vec3(.1,1,.3), 800, 0, .8, 1., 7);
	spheres[8] = Sphere(vec3(10.,89.,0.), vec3(.87,.6,.3), 80, 5*cos(u_time/50)+5, .8, 1., 8);
	spheres[9] = Sphere(vec3(20.,0.,5.), vec3(.2,.6,.3), 8, 0, .8, 1., 9);
	spheres[10] = Sphere(camera_pos, vec3(.2,.6,.3), 3, flashLight, .8, 1., 10);

				//Triangle  :   A               B                 C            COLOR    E   SPEC

	/*
	_triangles[0] = Triangle(vec3(0.), vec3(0.,10.,0.), vec3(10.,10,0),vec3(.1,.8,.8), 0., 0.8);
	_triangles[1] = Triangle(vec3(0.), vec3(10.,10.,0.), vec3(10,0,0),vec3(.1,.8,.8), 0., 0.8);
	_triangles[2] = Triangle(vec3(0.,0.,10.), vec3(0.,10.,10.), vec3(10.,10,10.),vec3(.1,.8,.8), 0., 0.8);
	_triangles[3] = Triangle(vec3(0.,-10.,10.), vec3(10.,10.,10.), vec3(10,-10,10),vec3(.1,.8,.8), 0., 0.8);
	_triangles[4] = Triangle(vec3(0.,0.,0.), vec3(0.,10.,0.), vec3(0.,10.,10.),vec3(.1,.8,.8), 0., 0.8);
	_triangles[5] = Triangle(vec3(0.,0.,0.), vec3(0.,0.,10.), vec3(0.,10.,10.),vec3(.1,.8,.8), 0., 0.8);
	_triangles[6] = Triangle(vec3(10.,10.,0.), vec3(10.,10.,0.), vec3(10.,-10.,10.),vec3(.1,.8,.8), 0., 0.8);
	_triangles[7] = Triangle(vec3(10.,10.,0.), vec3(10.,-10.,10.), vec3(10.,-10.,10.),vec3(.1,.8,.8), 0., 0.8);
	*/
	_triangles[0] = Triangle(vec3(0.), vec3(22.,-10.,0.), vec3(10.,10,10),vec3(.1,.8,.8), 0., 0.8);
	_triangles[1] = Triangle(vec3(0.), vec3(10.,-10.,15.), vec3(22,-10,0),vec3(.1,.8,.8), 0., 0.8);

	vec2 st = gl_FragCoord.xy / resolution;

	gl_FragColor = tone_map(trace_ray(camera_pos, world_to_canvas(st, 80.0), 1, 1000, 5, rotation, rotationY, st));
}
