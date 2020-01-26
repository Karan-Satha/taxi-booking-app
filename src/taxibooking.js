//Change navigation icon style

navToggle = navIcon => navIcon.classList.toggle("crossIcon");

const navButton = document.getElementById("navToggle");
const zoomOut = document.getElementById("zoomOutDiv");

navButton.onclick = function() {
  navToggle(this);
};

navButton.addEventListener("mouseenter", () =>
  zoomOut.classList.add("navInnerContainer-hover")
);

navButton.addEventListener("mouseleave", () =>
  zoomOut.classList.remove("navInnerContainer-hover")
);

//Autocomplete the address fields using google Autocomplete places API
function initAutocomplete() {
  // Find pickup lacation
  pickUpLocation = new google.maps.places.Autocomplete(pickUpLocationInput, {
    //Return only geocoding results and restrict to UK address
    types: ["geocode"],
    componentRestrictions: {
      country: ["gb"]
    }
  });

  // Find dropoff lacation
  dropOffLocation = new google.maps.places.Autocomplete(dropOffLocationInput, {
    //Return only geocoding results and restrict to UK address
    types: ["geocode"],
    componentRestrictions: {
      country: ["gb"]
    }
  });
}

const pickUpLocationInput = document.getElementById("pickUpLocation");
const dropOffLocationInput = document.getElementById("dropOffLocation");
const pickUpBgColor = document.getElementById("inputPickContainer");
const dropOffBgColor = document.getElementById("inputDropContainer");
const pickUpValidationMsg = document.getElementById("pickUpAddressValid");
const dropOffValidationMsg = document.getElementById("dropOffAddressValid");

changePickBgBlue = () => {
  pickUpBgColor.classList.remove("changeBgPurple");
  pickUpBgColor.classList.add("changeBgBlue");
};

changeDropBgBlue = () => {
  dropOffBgColor.classList.remove("changeBgPurple");
  dropOffBgColor.classList.add("changeBgBlue");
};

changePickBgPurple = () => {
  pickUpValidationMsg.innerHTML = "Please enter a valid address";
  pickUpBgColor.classList.remove("changeBgBlue");
  pickUpBgColor.classList.add("changeBgPurple");
  pickUpLocationInput.classList.add("changeBorderPurple");
};

changeDropBgPurple = () => {
  dropOffValidationMsg.innerHTML = "Please enter a valid address";
  dropOffBgColor.classList.remove("changeBgBlue");
  dropOffBgColor.classList.add("changeBgPurple");
  dropOffLocationInput.classList.add("changeBorderPurple");
};

removePickBgPurple = () => {
  pickUpValidationMsg.innerHTML = "";
  pickUpBgColor.classList.remove("changeBgPurple");
  pickUpBgColor.classList.remove("changeBgBlue");
  pickUpLocationInput.classList.remove("changeBorderPurple");
};

removeDropBgPurple = () => {
  dropOffValidationMsg.innerHTML = "";
  dropOffBgColor.classList.remove("changeBgPurple");
  dropOffBgColor.classList.remove("changeBgBlue");
  dropOffLocationInput.classList.remove("changeBorderPurple");
};

//Change input textbox background color

pickUpLocationInput.addEventListener("focus", () => changePickBgBlue());

pickUpLocationInput.addEventListener("focusout", () => {
  if (pickUpValidationMsg !== "") {
    removePickBgPurple();
  }
});

dropOffLocationInput.addEventListener("focus", () => changeDropBgBlue());

dropOffLocationInput.addEventListener("focusout", () => {
  if (dropOffValidationMsg !== "") {
    removeDropBgPurple();
  }
});

//Find distance between 2 addresses using google API distance matrix service

document.getElementById("getQuote").addEventListener("click", () => {
  // Validate input address
  pickUpLocationInput.value === ""
    ? changePickBgPurple()
    : removePickBgPurple();
  dropOffLocationInput.value === ""
    ? changeDropBgPurple()
    : removeDropBgPurple();

  getDistance();
});

//Find the distance

function getDistance() {
  var service = new google.maps.DistanceMatrixService();

  service.getDistanceMatrix(
    {
      origins: [pickUpLocationInput.value],
      destinations: [dropOffLocationInput.value],
      travelMode: google.maps.TravelMode.DRIVING,
      unitSystem: google.maps.UnitSystem.METRIC,
      durationInTraffic: true,
      avoidHighways: false,
      avoidTolls: false
    },

    function(response, status) {
      if (status !== google.maps.DistanceMatrixStatus.OK) {
        alert("Error:", status);
      } else {
        // Get value in metres and convert to kilometres
        let distanceMetre = response.rows[0].elements[0].distance.value;

        // Round kilometres to 2nd decimel point
        document.getElementById("distanceKm").innerHTML =
          (distanceMetre / 1000).toFixed(2) + " " + "Kilometres";

        // Change metres to miles
        let distanceMile = (distanceMetre / 1000) * 0.621371;

        // Round miles to 2nd decimel point
        document.getElementById("distanceMile").innerHTML =
          distanceMile.toFixed(2) + " " + "Miles";

        // Find the time duration
        let duration = response.rows[0].elements[0].duration.text;
        document.getElementById("duration").innerHTML = duration;

        // Find departure address
        let depatureFullAddress = response.originAddresses[0];
        document.getElementById(
          "depatureFullAddress"
        ).innerHTML = depatureFullAddress;

        // Find arrival address
        let arrivalFullAddress = response.destinationAddresses[0];
        document.getElementById(
          "arrivalFullAddress"
        ).innerHTML = arrivalFullAddress;
      }

      document.getElementById("journeyDetailsDisplayId").style.visibility =
        "visible";
    }
  );
}

//Clear textbox on times button click

document
  .getElementById("clearButtonPick")
  .addEventListener("click", () => (pickUpLocationInput.value = ""));

document
  .getElementById("clearButtonDrop")
  .addEventListener("click", () => (dropOffLocationInput.value = ""));

//Change button BG color on mouse over

const mouseEvent = document.getElementById("getQuote");
const btnBgColorCng = document.getElementById("getQuoteBtnCId");

mouseEvent.addEventListener(
  "mouseenter",
  () => (btnBgColorCng.style.backgroundColor = "rgba(15, 172, 243, 0.4)")
);

mouseEvent.addEventListener(
  "mouseleave",
  () => (btnBgColorCng.style.backgroundColor = "rgba(15, 172, 243, 0.2)")
);
