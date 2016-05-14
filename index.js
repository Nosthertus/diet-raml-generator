#!/usr/bin/env node

var raml      = require('./lib/raml.js');
var file      = require('./lib/file.js');
var utils     = require('utils')._;
var argv      = require('./lib/args.js');
var dietUtils = require('./lib/diet.js');
var coder     = require('./lib/coder.js');
var path      = require('path');

var ramlParser = new raml(argv.t, false);

var resources = ramlParser.resources();
var errors = ramlParser.allStatusErrors();

console.log("Directory selected:", argv.d);

utils.each(resources, function(resource){
	var text = '',
	tab = "\t",
	routes = [];

	console.log('Generating resources:', resource.name);

	var script = new file();

	script.directory = argv.d;

	script.setName(resource.name);

	routes = buildRoutes(resource);

	script.addContent(routes.join("\n\n"));

	script.requireErrorHandler = true;
	script.inFunction = true;

	script.build();
});

generateErrors(errors);
generateErrorHandler();
generateIndex();
generateSchemas();

function buildRoutes(resource){
	routes = [];

	if(resource.methods.length > 0){
		utils.each(resource.methods, function(method){
			var code = dietUtils.parseUriParams(resource.completeRelativeUri);
			var route = coder.createRoute(code, method);
			routes.push(route);
		})
	}

	if(resource.childs.length > 0){
		utils.each(resource.childs, function(child){
			routes = routes.concat(buildRoutes(child));
		});
	}

	return routes;
}

function generateErrors(errors){
	if(!argv.e){
		console.log('Generating: Error JSON file')
		var errorStr = JSON.stringify(coder.parseErrors(errors));

		var script = new file();

		script.directory = argv.d;
		script.setName('errors.json');

		script.addContent(coder.indentCode(errorStr));

		script.build();
	}
}

function generateErrorHandler(){
	if(!argv.e){
		console.log('Generating: Error Handler file');
		var script = new file();

		script.directory = argv.d;
		script.setName('errorHandler');

		script.addContent(coder.errorHandler());

		script.build();
	}
}

function generateIndex(){
	if(!argv.n){
		console.log('Generating: Index file');
		var script = new file();

		var index = {
			errors: '',
			handler: '',
			requires: ''
		};

		script.directory = argv.d;
		script.setName('index');

		utils.each(resources, function(resource){
			index.requires += "require('./" + resource.name + "');\n";
		});

		index.errors = coder.indentCode('var methodStatus = ' + JSON.stringify(coder.parseErrors(errors, true)) + ';');
		
		index.handler = coder.loadTemplate('index_handler');

		for(code in index)
			script.addContent(index[code] + '\n\n');

		script.inFunction = true;
		script.requireErrorHandler = true;

		script.build();
	}
}

function generateSchemas(){
	if(argv.h){
		var schemas = ramlParser.schemas();

		var dir = path.join(argv.d, "schemas");

		console.log("Copying schemas to directory:", dir);

		utils.each(schemas, function(schema){

			var script = new file();
			var name = new String;

			// Get the resource name from the schema data
			for(k in schema){
				name = k;
			}

			console.log("Copying schema:", name);

			script.directory = dir;
			script.setName(name + ".json");

			script.addContent(schema[name]);

			script.build();
		})
	}
}