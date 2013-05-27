/**
 * FusionCharts Chart Generator (prototype)
 * This module loads configuration data for all charts
 * from a single Application XML,  
 * renders the charts through view HTML Application and
 * captures charts in separate image files.
 * 
 * PhantomJS 1.9  <https://raw.github.com/ariya/phantomjs/master/LICENSE.BSD>
 *
 **/
 
 /*
 
  Workflow:
	 1. The PhantomJS Application (control.js) is executed through command-line
	 2. The path of the single XML containing configurations and data for
		all is passed as argument to control.js 
	 3. Optional configurations like CaptureDelayMs and ZoomFactor are passed
		respectively as additional arguments to control.js
	 4. controls.js reads the content of the XML 
	 5. control.js loads view.html (HTML Application) 
	 6. view.html notifies control.js that it has been loaded
	 7. control.js passes XML to view.html
	 8. view.html parses the XML, retrieves Application configurations
	 9. view.html passes Application configurations to control.js
	10. control.js updates and merges Application configurations 
	11. view.html retrieves chart configurations and data from XML
	12. view.html renders each chart 
	13. On render completion of each chart, view.html notifies control.js 
	14. view.html also passes output filename, page coordinates to capture
	15. control.js captures chart as image and stores in specified location
	16. On completion of capture, control.js exits application
  
  Command-line Syntax:
  
  phantomjs control.js XMLPath [CaptureDelayInMilliseconds] [ZoomFactor]
    

  */
 
var page = new WebPage(),
	system = require('system'),
	args = system.args,
	viewHTMLApp = "view.html",
	defaultAppConfig = {
		captureDelayMs: 200,
		outputFolder: '',
		outputType: 'jpg',
		zoom: 1
	},
	appConfig = {},
	outputFile,
	clipRect,
	extend,
	xmlPath,
	xmlString,
	delay,
	zoom,
	begins = +new Date();

// Check Application arguments
if (args.length >= 2) {
	
	// Retrieve Application XML path from Application argument
	xmlPath = args[1];
	
	// Open Application XML
	page.open(xmlPath, function (status) {
	
		// Throw error and exit application when Application XML loading fails
		if (status !== 'success') {
			console.error("Error: Failed to load data from " + xmlPath  + ".");
			phantom.exit();
		}
		
		/**
		 * Retrieve Application XML as string.
		 * The Application XML contains all the configurations needed to
		 * render multiple charts in the HTML Application.
		 * It provides Application configurations like 
		 * output format, output folder, capture delay
		 * It also provides configuration details of each 
		 * chart through `visualization` nodes
		 * Each `visualization` node contains 
		 * chart type, width, height, output filename and
		 * chart XML data (as per FusionCharts XML format) in `chart' node
		 */
		xmlString = page.content;

		// Load HTML Application
		page.open (viewHTMLApp, function (status) {
	
			// Throw error and exit application when HTML loading fails	
			if (status !== 'success') {
				console.error("Error: Failed to load HTML Application.");
				phantom.exit();
			}
		});	

		// Show console message from HTML Application
		page.onConsoleMessage = function (msg, lineNum, sourceId) {
			console.log('[#' + lineNum + ':' + sourceId + '] ' + msg);
		};
		
		/** 
		 * Open communication channel with HTML Application
		 * through onCallBack event listener.
		 * `onCallback` event is raised whenever the HTML Application 
		 * invokes window.callPhantom function. 
		 * An object is passed through the `argument`.
		 * The listener can return a value to the HTML Application.
		 */
		page.onCallback = function (argument) {

			/** HTML Application has passed `ready` flag (as true) in argument.
			 * The `ready` flag denotes that the page is ready 
			 * to start rendering chart.
			 */
			if (argument.ready) {
				// Pass the Application XML to the HTML Application
	    		return xmlString;
	    	}
			
			/** HTML Application announces through `appConfig` flag (as true)
			 * that Application configuration is parsed and passed through 
			 * the `config` property of `argument`
			 */ 
			else if (argument.appConfig) {
			
				// Update and merge Application configuration with defaults
				appConfig = extend({}, defaultAppConfig, argument.config);

				// Further validate and update Applicaiton configuration
			
				// Retrieve delay from Application argument (if present)
				// or set from Application configuration
				delay = Math.abs(parseInt(isNaN(parseInt(args[2])) ?  
							appConfig.captureDelayMs : args[2]));
				// Validate delay
				delay = isNaN(delay) ? 200 : delay;

				// Retrieve zoom factor from Application argument
				// or set from Application configuration 
				zoom = Math.abs(parseFloat(isNaN(parseFloat(args[3])) ?
						appConfig.zoom : args[3]));
				// Validate zoom factor
				// Reset zoom factor to 1 for unwanted value
				if (zoom == 0 || isNaN(zoom)) {
					zoom = 1;
				}

				// Set zoom factor for page 
				page.zoomFactor = zoom;

				
			} 
			
			/** HTML Application announces that a chart has been rendered 
			 * through `rendered` flag(true).
			 * The chart now can be captured as image.
			 *
			 * Properties sent from HTML Application through `argument' are:
			 *
			 * clipRect (Object)	The rectangle coordinates of the 
			 *						chart's position in the page. 
			 * 					   	The properties are left, top, width, height.
			 * 
			 * chart (object)		The chart object.
			 *
			 * saveAs (string)		Filename (without extension) for the 
			 *						captured image of the chart.
			 * 			
			 * allRendered(boolean)	`true` when all charts are rendered.
			 * 						This flag is essential to exit application.
			 */
	    	else if (argument.rendered) {

	    		if (appConfig.outputType.toLowerCase() !== 'pdf') {
			
					// Delay capturing
		    		window.setTimeout(function () {
		    			
						// Re-calculate chart's rectangular coordinates 
						// based on zoom factor
						clipRect = {
							top: (argument.clipRect.top * zoom), 
							left: (argument.clipRect.left * zoom), 
							width: (argument.clipRect.width * zoom), 
							height: (argument.clipRect.height * zoom)
						};				
						
						// Set capture rectangular coordinates on the page
		    			page.clipRect = clipRect;
						
						// Generate capture filename
						outputFile = appConfig.outputFolder + 
									argument.saveAs + "." + 
									appConfig.outputType; 
									
						// Capture chart into image file
						page.render(outputFile);
	    		

					// Exit application when all charts are rendered
					// and captured
					if (argument.allRendered) {
						console.log("Execution completed in " + 
							((+new Date()) - begins) + "ms.");
						console.log("All images files are stored in " + 
							appConfig.outputFolder + " folder.");
						
						if (appConfig.outputType.toLowerCase() === 'pdf') {
							page.clipRect = {};
							page.render(appConfig.outputFolder + 'NewPage.pdf');

						}
						// uncomment the following 2 lines below to capture the full page as a single image
						//page.clipRect = {};
						//page.render(appConfig.outputFolder + 'fullpage.png');
						
						phantom.exit();
					}
					
				}, delay);
			}
			else {
				if (argument.allRendered) {
					if (appConfig.outputType.toLowerCase() === 'pdf') {
						page.clipRect = {};
						page.paperSize = {format: 'A3', orientation: 'landscape', border: '1cm'};
						page.render(appConfig.outputFolder + 'NewPage.pdf');

					}
					// uncomment the following 2 lines below to capture the full page as a single image
					//page.clipRect = {};
					//page.render(appConfig.outputFolder + 'fullpage.png');
					
					phantom.exit();

				}
			}

	    	}

		};	    
	});

} 
// Throw error as no XML path has been defined in Application argument
else {
	console.log('Error: Missing arguments.');
	console.log('Usage: control.js XMLURL [delay] [zoom]');
	phantom.exit();
}

/**
 * Extend and merge objects
 * Used to update default configurations with
 * configurations from Application XML
 * 
 */
extend = function(){
    for (var i=1; i<arguments.length; i++)
        for (var key in arguments[i])
            if (arguments[i].hasOwnProperty(key)) {
				if (arguments[i][key] !== "") {
					arguments[0][key] = arguments[i][key];
				}
			}
                
    return arguments[0];
};