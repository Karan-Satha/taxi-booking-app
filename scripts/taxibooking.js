("use strict");

//Change navigation icon style
const navToggle = navIcon => navIcon.classList.toggle("crossIcon");

const navButton = document.getElementById("navToggle");
navButton.onclick = function() {
  navToggle(this);
};

const zoomOut = document.getElementById("zoomOutDiv");
navButton.addEventListener("mouseenter", () =>
  zoomOut.classList.add("navInnerContainer-hover")
);

navButton.addEventListener("mouseleave", () =>
  zoomOut.classList.remove("navInnerContainer-hover")
);

//Autocomplete the address fields using google Autocomplete places API
function initAutocomplete() {
  // Find pickup lacation
  let pickUpLocation = new google.maps.places.Autocomplete(
    pickUpLocationInput,
    {
      //Return only geocoding results and restrict to UK address
      types: ["geocode"],
      componentRestrictions: {
        country: ["gb"]
      }
    }
  );

  // Find dropoff lacation
  let dropOffLocation = new google.maps.places.Autocomplete(
    dropOffLocationInput,
    {
      //Return only geocoding results and restrict to UK address
      types: ["geocode"],
      componentRestrictions: {
        country: ["gb"]
      }
    }
  );
}

const pickUpLocationInput = document.getElementById("pickUpLocation");
const dropOffLocationInput = document.getElementById("dropOffLocation");
const pickUpBgColor = document.getElementById("inputPickContainer");
const dropOffBgColor = document.getElementById("inputDropContainer");
const pickUpValidationMsg = document.getElementById("pickUpAddressValid");
const dropOffValidationMsg = document.getElementById("dropOffAddressValid");
const journeyDetail = document.getElementById("journeyDetailsDisplayId");

const changePickBgBlue = () => {
  pickUpBgColor.classList.remove("changeBgPurple");
  pickUpBgColor.classList.add("changeBgBlue");
};

const changeDropBgBlue = () => {
  dropOffBgColor.classList.remove("changeBgPurple");
  dropOffBgColor.classList.add("changeBgBlue");
};

const changePickBgPurple = () => {
  pickUpValidationMsg.innerHTML = "*Please enter a valid address";
  pickUpBgColor.classList.remove("changeBgBlue");
  pickUpBgColor.classList.add("changeBgPurple");
  pickUpLocationInput.classList.add("changeBorderPurple");
};

const changeDropBgPurple = () => {
  dropOffValidationMsg.innerHTML = "*Please enter a valid address";
  dropOffBgColor.classList.remove("changeBgBlue");
  dropOffBgColor.classList.add("changeBgPurple");
  dropOffLocationInput.classList.add("changeBorderPurple");
};

const removePickBgPurple = () => {
  pickUpValidationMsg.innerHTML = "";
  pickUpBgColor.classList.remove("changeBgPurple");
  pickUpBgColor.classList.remove("changeBgBlue");
  pickUpLocationInput.classList.remove("changeBorderPurple");
};

const removeDropBgPurple = () => {
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
  if (pickUpLocationInput.value && dropOffLocationInput.value !== "") {
    getDistance();
  } else {
    pickUpLocationInput.value === ""
      ? changePickBgPurple()
      : removePickBgPurple();
    dropOffLocationInput.value === ""
      ? changeDropBgPurple()
      : removeDropBgPurple();
    journeyDetail.style.display = "none";
  }
});

//Find the distance

const fare = [
  {
    baseFare: 2.5,
    minimumFare: 5,
    farePerMinute: 0.15,
    farePerMile: 1.25,
    imgUrl: "./images/taxi5.png",
    carType: "Saloon",
    carDescription:
      "Medium car with professional driver, suitable for up to 4 people",
    person: 4,
    luggage: 2
  },

  {
    baseFare: 3.5,
    minimumFare: 7,
    farePerMinute: 0.15,
    farePerMile: 2.1,
    imgUrl: "./images/taxi7.png",
    carType: "6 Seater MPV",
    carDescription: "MPV with professional driver, suitable for up to 6 people",
    person: 6,
    luggage: 2
  },

  {
    baseFare: 4,
    minimumFare: 9,
    farePerMinute: 0.15,
    farePerMile: 2.5,
    imgUrl: "./images/taxi9.png",
    carType: "9 Seater people carrier",
    carDescription:
      "People carrier with professional driver, suitable for up to 8 people",
    person: 8,
    luggage: 3
  }
];

const getDistance = () => {
  let service = new google.maps.DistanceMatrixService();

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

    (response, status) => {
      if (status !== google.maps.DistanceMatrixStatus.OK) {
        alert`(Error: ${status})`;
      } else {
        // Get distance value in metres
        const distanceInMetre = response.rows[0].elements[0].distance.value;

        // Convert metres into kilometres and round it to 1st decimel point
        const distancekm = document.getElementById("distanceKm");
        (distanceInKM => {
          distanceInKM = (distanceInMetre / 1000).toFixed(1);
          distancekm.innerHTML = ` &nbsp;${distanceInKM} Kilometres`;
          distancekm.style.display = "none";
        })();

        // Change metres to miles and round miles to 2nd decimel point
        const distanceInMile = ((distanceInMetre / 1000) * 0.621371).toFixed(1);
        document.getElementById(
          "distanceMile"
        ).innerHTML = `${distanceInMile} miles &nbsp;<button id="inkm">View in KM</button>`;

        // Show distance in KM
        document.getElementById("inkm").addEventListener("click", () => {
          distancekm.style.display = "block";
        });

        // Find the time duration
        const travelDuration = response.rows[0].elements[0].duration.text;
        document.getElementById("duration").innerHTML = travelDuration;

        // Find departure address
        const depatureFullAddress = response.originAddresses[0];
        document.getElementById(
          "depatureFullAddress"
        ).innerHTML = depatureFullAddress;

        // Find arrival address
        const arrivalFullAddress = response.destinationAddresses[0];
        document.getElementById(
          "arrivalFullAddress"
        ).innerHTML = arrivalFullAddress;

        let durationInMinute = 0;
        durationInMinute = response.rows[0].elements[0].duration.value / 60;

        const totalFare = fare.map(fare => {
          const finalFare = (
            fare.farePerMinute * durationInMinute +
            fare.farePerMile * distanceInMile +
            fare.baseFare +
            fare.minimumFare
          ).toFixed(0);
          return `<div class="serviceType">
            <h1 class="fare">£${finalFare}</h1>
            <img class="vehicleImage" src=${fare.imgUrl} />

            <div class="serviceInfo">
            <h1>${fare.carType}</h1>
            <p>${fare.carDescription}</p>              
            <div class="buttonContainer">  
            <div>                    
            <i class="fas fa-user-friends"><span> ${fare.person}</span></i>
            <i class="fas fa-suitcase"><span> ${fare.luggage}</span></i> 
            </div>           
            <button>SELECT FARE</button> 
            </div>           
            </div>                        
            </div>`;
        });

        document.getElementById("serviceX").innerHTML = `${totalFare[0]}`;
        document.getElementById("serviceXL").innerHTML = `${totalFare[1]}`;
        document.getElementById("serviceXXL").innerHTML = `${totalFare[2]}`;
      }

      journeyDetail.style.display = "block";
    }
  );
};

//Clear textbox on times button click

document
  .getElementById("clearButtonPick")
  .addEventListener("click", () => (pickUpLocationInput.value = ""));

document
  .getElementById("clearButtonDrop")
  .addEventListener("click", () => (dropOffLocationInput.value = ""));

const travelInfo = [
  {
    car: "5 Seater",
    fare: 2.5,
    imgUrl: "./images/taxi5.jpg"
  },
  {
    car: "7 Seater",
    imgUrl: "./images/taxi7.png",
    fare: 3
  },
  {
    car: "9 Seater",
    imgUrl: "./images/taxi9.jpg",
    fare: 3.5
  }
];
