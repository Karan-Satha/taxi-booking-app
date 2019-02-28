//................................ Change navigation icon style

document.getElementById("navToggle").onclick = function() {navToggle(this)};

function navToggle(x) {
	x.classList.toggle("crossIcon");
}

document.getElementById("navToggle").addEventListener("mouseenter", function() {
	
	let zoomOut = document.getElementById("zoomOutDiv");
	zoomOut.classList.add("navInnerContainer-hover");
});

document.getElementById("navToggle").addEventListener("mouseleave", function() {
	
	let zoomOut = document.getElementById("zoomOutDiv");
	zoomOut.classList.remove("navInnerContainer-hover");
});



//Autocomplete the address fields using google Autocomplete places API
function initAutocomplete() {

	var pickUpLocation, dropOffLocation;

	// Find pickup lacation
	pickUpLocation = new google.maps.places.Autocomplete(
		(document.getElementById('pickUpLocation')), 

		{
			//Return only geocoding results and restrict to UK address 
			types: ['geocode'],
			componentRestrictions: {				
				country: ['gb']
			}
		});

	// Find dropoff lacation
	dropOffLocation = new google.maps.places.Autocomplete(
		(document.getElementById('dropOffLocation')), 

		{
			//Return only geocoding results and restrict to UK address
			types: ['geocode'],
			componentRestrictions: {
				country: ['gb']
			}
		});
}


//............................Remove vadidation error when there are valid inputs

var pickUpLocationInput = document.getElementById("pickUpLocation");

pickUpLocationInput.addEventListener("change", function() {	

	if(pickUpLocationInput.value != "") {
		pickUpLocationInput.classList.remove("userAddressInput-click");
		document.getElementById("pickUpAddressValid").innerHTML = "";		
	}

});


var dropOffLocationInput = document.getElementById("dropOffLocation");

dropOffLocationInput.addEventListener("change", function() {	

	if(dropOffLocationInput.value != "") {
		dropOffLocationInput.classList.remove("userAddressInput-click");
		document.getElementById("dropOffAddressValid").innerHTML = "";
	}

});


//............................ Change input background color 

pickUpLocationInput.addEventListener("focus", function() {		

	var pickBgColor = document.getElementById("inputPickContainer");	

	pickBgColor.classList.remove("userAddressInputBg-click");
	pickBgColor.classList.add("userAddressInput-focus");

});

pickUpLocationInput.addEventListener("focusout", function() {

	var validationMsg = document.getElementById("pickUpAddressValid").innerHTML;
	var pickBgColor = document.getElementById("inputPickContainer");
	
	pickBgColor.classList.remove("userAddressInput-focus");
	
	if(validationMsg != "") {
		pickBgColor.classList.add("userAddressInputBg-click");
	}

});

dropOffLocationInput.addEventListener("focus", function() {	
	var dropBgColor = document.getElementById("inputDropContainer");
	dropBgColor.classList.remove("userAddressInputBg-click");
	dropBgColor.classList.add("userAddressInput-focus");
});

dropOffLocationInput.addEventListener("focusout", function() {	
	var validationMsg = document.getElementById("dropOffAddressValid").innerHTML;
	var dropBgColor = document.getElementById("inputDropContainer");
	
	dropBgColor.classList.remove("userAddressInput-focus");
	
	if(validationMsg != "") {
		dropBgColor.classList.add("userAddressInputBg-click");
	}
});








//....................... Find distance between 2 addresses using google API distance matrix service

document.getElementById("getQuote").addEventListener("click", function(){


	//	Get address input value 
	var pickUpLocationInput = document.getElementById("pickUpLocation");
	var dropOffLocationInput = document.getElementById("dropOffLocation");
	var pickUpInputValidation = document.getElementById("pickUpAddressValid");
	var dropOffInputValidation = document.getElementById("dropOffAddressValid");
	var pickBgColor = document.getElementById("inputPickContainer");
	var dropBgColor = document.getElementById("inputDropContainer");

	// Validate input address
	if (pickUpLocationInput.value == "") {
		pickUpInputValidation.innerHTML = "Please enter a valid address"; 			
		pickUpLocationInput.classList.add("userAddressInput-click");		
		pickBgColor.classList.add("userAddressInputBg-click");

	} else {
		pickUpInputValidation.innerHTML = "";		
		pickUpInputValidation.classList.remove("userAddressInput-click");
		pickBgColor.classList.remove("userAddressInputBg-click");
	}

	if (dropOffLocationInput.value == "") {
		dropOffInputValidation.innerHTML = "Please enter a valid address";		
		dropOffLocationInput.classList.add("userAddressInput-click");
		dropBgColor.classList.add("userAddressInputBg-click");

	} else {
		dropOffInputValidation.innerHTML = "";		
		dropOffLocationInput.classList.remove("userAddressInput-click");
	}


	//Find the distance
	var service = new google.maps.DistanceMatrixService();

	service.getDistanceMatrix({			
		origins: [pickUpLocationInput.value],		
		destinations: [dropOffLocationInput.value],
		travelMode: google.maps.TravelMode.DRIVING,
		unitSystem: google.maps.UnitSystem.METRIC,
		durationInTraffic: true,
		avoidHighways: false,
		avoidTolls: false 
	},

							  function (response, status) {

		if (status !== google.maps.DistanceMatrixStatus.OK) {
			alert('Error:', status);

		} else {	

			// Get value in metres and convert to kilometres
			var distanceMetre = response.rows[0].elements[0].distance.value;

			// Round kilometres to 2nd decimel point
			document.getElementById("distanceKm").innerHTML = (distanceMetre/1000).toFixed(2) + " " + "Kilometres";

			// Change metres to miles
			var distanceMile = (distanceMetre / 1000) * (0.621371); 

			// Round miles to 2nd decimel point
			document.getElementById("distanceMile").innerHTML = distanceMile.toFixed(2) + " " + "Miles";

			// Find the time duration
			var duration = response.rows[0].elements[0].duration.text;
			document.getElementById("duration").innerHTML = duration;

			// Find departure address
			var depatureFullAddress = response.originAddresses[0];
			document.getElementById("depatureFullAddress").innerHTML = depatureFullAddress;

			// Find arrival address
			var arrivalFullAddress = response.destinationAddresses[0];
			document.getElementById("arrivalFullAddress").innerHTML = arrivalFullAddress;			

		}

		document.getElementById("journeyDetailsDisplayId").style.visibility = "visible";
	});

});

//.........................  Clear textbox on times button click

document.getElementById("clearButtonPick").addEventListener("click", function(){	
	document.getElementById("pickUpLocation").value="";
});

document.getElementById("clearButtonDrop").addEventListener("click", function(){	
	document.getElementById("dropOffLocation").value="";
});


//.........................  Change button BG color on mouse over

var mouseEvent = document.getElementById("getQuote");
var btnBgColorCng = document.getElementById("getQuoteBtnCId");

mouseEvent.addEventListener("mouseenter", function() {
	btnBgColorCng.style.backgroundColor = "rgba(15, 172, 243, 0.4)";
});

mouseEvent.addEventListener("mouseleave", function(){
	btnBgColorCng.style.backgroundColor = "rgba(15, 172, 243, 0.2)";
});




