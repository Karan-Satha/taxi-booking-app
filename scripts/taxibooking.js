("use strict");

// Shorthand for dom element
const element = (id) => {
  return document.querySelector(id);
};

document.onreadystatechange = function () {
  if (document.readyState !== "complete") {
    document.querySelector("body").style.visibility = "hidden";
    document.querySelector("#loader").style.visibility = "visible";
  } else {
    document.querySelector("#loader").style.display = "none";
    document.querySelector("body").style.visibility = "visible";
  }
};

const [
  pickUpLocationInput,
  dropOffLocationInput,
  dateInput,
  timeInput,
  pickUpBgColor,
  dropOffBgColor,
  dateBgColor,
  timeBgColor,
  pickUpValidationMsg,
  dropOffValidationMsg,
  dateValidationMsg,
  timeValidationMsg,
  journeyDetail,
] = [
  element("#pickUpLocation"),
  element("#dropOffLocation"),
  element("#date"),
  element("#time"),
  element("#inputPickContainer").classList,
  element("#inputDropContainer").classList,
  element("#inputDateContainer").classList,
  element("#inputTimeContainer").classList,
  element("#pickUpAddressValid"),
  element("#dropOffAddressValid"),
  element("#dateValid"),
  element("#timeValid"),
  element(".journeyMain"),
];

//Smooth scroll
const scrollTo = (elem) => {
  window.scroll({
    behavior: "smooth",
    left: 0,
    top: elem.offsetTop,
  });
};

//Change navigation icon style
const navToggle = (navIcon) => navIcon.classList.toggle("crossIcon");

const navButton = element("#navToggle");
navButton.onclick = function () {
  navToggle(this);
};

const zoomOut = element("#zoomOutDiv");
navButton.addEventListener("mouseenter", () =>
  zoomOut.classList.add("navInnerContainer-hover")
);

navButton.addEventListener("mouseleave", () =>
  zoomOut.classList.remove("navInnerContainer-hover")
);

//Autocomplete the address fields using google Autocomplete places API

let selected = false;
function initAutocomplete() {
  // Find pickup lacation
  pickUpLocation = new google.maps.places.Autocomplete(pickUpLocationInput, {
    //Return only geocoding results and restrict to UK address
    types: ["geocode"],
    componentRestrictions: {
      country: ["gb"],
    },
  });

  // Find dropoff lacation
  dropOffLocation = new google.maps.places.Autocomplete(dropOffLocationInput, {
    //Return only geocoding results and restrict to UK address
    types: ["geocode"],
    componentRestrictions: {
      country: ["gb"],
    },
  });
}

// Clear input field if not selected from dropdown
$(".userInputAddress")
  .on("focus", function () {
    selected = false;
  })
  .on("blur", function () {
    if (!selected) {
      $(this).val("");
    }
  });

// Add blue shadow border to pickup-address field
const addPickBgBlue = () => {
  pickUpBgColor.remove("changeBgPurple");
  pickUpBgColor.add("changeBgBlue");
};

// Add blue shadow border to dropoff-address field
const addDropBgBlue = () => {
  dropOffBgColor.remove("changeBgPurple");
  dropOffBgColor.add("changeBgBlue");
};

// Add blue shadow border to date field
const addDateBgBlue = () => {
  dateBgColor.remove("changeBgPurple");
  dateBgColor.add("changeBgBlue");
};

// Add blue shadow border to time field
const addTimeBgBlue = () => {
  timeBgColor.remove("changeBgPurple");
  timeBgColor.add("changeBgBlue");
};

// Add purple shadow border and validation msg to pickup-address field
const addPickBgPurple = () => {
  pickUpValidationMsg.innerHTML = `<i class="fas fa-info-circle"></i> Please enter a valid address`;
  pickUpBgColor.remove("changeBgBlue");
  pickUpBgColor.add("changeBgPurple");
  pickUpLocationInput.classList.add("changeBorderPurple");
};

// Add purple shadow border and validation msg to dropoff-address field
const addDropBgPurple = () => {
  dropOffValidationMsg.innerHTML = `<i class="fas fa-info-circle"></i> Please enter a valid address`;
  dropOffBgColor.remove("changeBgBlue");
  dropOffBgColor.add("changeBgPurple");
  dropOffLocationInput.classList.add("changeBorderPurple");
};

// Add purple shadow border and validation msg to date field
const addDateBgPurple = () => {
  dateValidationMsg.innerHTML = `<i class="fas fa-info-circle"></i> Please enter a valid date`;
  dateBgColor.remove("changeBgBlue");
  dateBgColor.add("changeBgPurple");
  dateInput.classList.add("changeBorderPurple");
};

// Add purple shadow border and validation msg to time field
const addTimeBgPurple = () => {
  timeValidationMsg.innerHTML = `<i class="fas fa-info-circle"></i> Please enter a valid time`;
  timeBgColor.remove("changeBgBlue");
  timeBgColor.add("changeBgPurple");
  timeInput.classList.add("changeBorderPurple");
};

// Remove purple shadow border and validation msg from pickup-address field
const removePickBgPurple = () => {
  pickUpValidationMsg.innerHTML = "";
  pickUpBgColor.remove("changeBgPurple", "changeBgBlue");
  pickUpLocationInput.classList.remove("changeBorderPurple");
};

// Remove purple shadow border and validation msg from dropoff-address field
const removeDropBgPurple = () => {
  dropOffValidationMsg.innerHTML = "";
  dropOffBgColor.remove("changeBgPurple", "changeBgBlue");
  dropOffLocationInput.classList.remove("changeBorderPurple");
};

// Remove purple shadow border and validation msg from date field
const removeDateBgPurple = () => {
  dateValidationMsg.innerHTML = "";
  dateBgColor.remove("changeBgPurple", "changeBgBlue");
  dateInput.classList.remove("changeBorderPurple");
};

// Remove purple shadow border and validation msg from time field
const removeTimeBgPurple = () => {
  timeValidationMsg.innerHTML = "";
  timeBgColor.remove("changeBgPurple", "changeBgBlue");
  timeInput.classList.remove("changeBorderPurple");
};

// Add blue border to pickup-address field on focus
pickUpLocationInput.addEventListener("focus", () => {
  addPickBgBlue();
});

// Add purple border to pickup-address field on focusout
pickUpLocationInput.addEventListener("focusout", () => {
  if (pickUpLocationInput.value === "") {
    addPickBgPurple();
  }

  if (pickUpLocationInput.value !== "") {
    removePickBgPurple();
  }
});

// Add blue border to dropoff-address field on focus
dropOffLocationInput.addEventListener("focus", () => {
  addDropBgBlue();
});

// Add purple border to dropoff-address field on focusout
dropOffLocationInput.addEventListener("focusout", () => {
  if (dropOffLocationInput.value === "") {
    addDropBgPurple();
  }
  if (dropOffLocationInput.value !== "") {
    removeDropBgPurple();
  }
});

// Add blue border to date field on focus
dateInput.addEventListener("focus", () => {
  addDateBgBlue();
});

// Validate date function
const validateDate = () => {
  const [datePicker, today, dateValue] = [
    new Date(dateInput.value),
    new Date(),
    dateInput.value,
  ];

  // Assign variables
  const [datePickerYear, datePickerMonth, datePickerDate] = [
    datePicker.getFullYear(),
    datePicker.getMonth(),
    datePicker.getDate(),
  ];

  const [currentYear, currentMonth, currentDate] = [
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ];

  // Check the field if it is empty
  if (dateValue === "") {
    addDateBgPurple();
  }

  // Check the field if it is not empty
  if (dateValue !== "") {
    removeDateBgPurple();
  }

  // Check the year valid
  if (datePickerYear < currentYear) {
    addDateBgPurple();
    dateValidationMsg.innerHTML = `<i class="fas fa-info-circle"></i> Please check the year`;
  }

  // Check the year and month valid
  if (datePickerYear <= currentYear && datePickerMonth < currentMonth) {
    addDateBgPurple();
    dateValidationMsg.innerHTML = `<i class="fas fa-info-circle"></i> Please check the month`;
  }

  // Check the year, month, and date valid
  if (
    datePickerYear <= currentYear &&
    datePickerMonth <= currentMonth &&
    datePickerDate < currentDate
  ) {
    addDateBgPurple();
    dateValidationMsg.innerHTML = `<i class="fas fa-info-circle"></i> Please check the date`;
  }
};

// Bind two events to date input element
["focusout", "change"].forEach(function (e) {
  dateInput.addEventListener(e, validateDate, false);
});

// Set date placeholder
dateInput.placeholder = `e.g: ${new Date().toLocaleDateString()}`;

// Add time option to time field
let halfHour = ["00", "30"];
for (let i = 0; i < 24; i++) {
  if (i < 10) {
    i = "0" + i;
  }
  for (let j = 0; j < 2; j++) {
    timeInput.add(new Option(i + ":" + halfHour[j]));
  }
}

timeInput.addEventListener("focus", () => {
  addTimeBgBlue();
});

timeInput.addEventListener("focusout", () => {
  let selectedTime = timeInput.value;
  if (selectedTime === "") {
    addTimeBgPurple();
  }
  if (selectedTime !== "") {
    removeTimeBgPurple();
  }
});

timeInput.addEventListener("change", () => {
  let selectedTime = timeInput.value;
  if (selectedTime !== "") {
    removeTimeBgPurple();
  }
});

// Validate input fields on submit button click
element("#getQuote").addEventListener("click", (event) => {
  //event.preventDefault();
  const [pickUpValue, dropOffValue, dateValue, timeValue] = [
    pickUpLocationInput.value,
    dropOffLocationInput.value,
    dateInput.value,
    timeInput.value,
  ];

  if (
    pickUpValue &&
    dropOffValue &&
    dateValue &&
    timeValue !== "" &&
    dateValidationMsg.innerHTML === "" &&
    timeValidationMsg.innerHTML === ""
  ) {
    getDistance();
    journeyDetail.style.display = "block";
    scrollTo(element(".journeyMain"));
  } else {
    pickUpValue === "" ? addPickBgPurple() : removePickBgPurple();
    dropOffValue === "" ? addDropBgPurple() : removeDropBgPurple();
    dateValue === "" ? addDateBgPurple() : removeDateBgPurple();
    timeValue === "" ? addTimeBgPurple() : removeTimeBgPurple();
    journey
      ? (journeyDetail.style.display = "block")
      : (journeyDetail.style.display = "none");
    validateDate();
    //journeyDetail.style.display = "none";
  }
});

//Find distance between 2 addresses using google API distance matrix service
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
      avoidTolls: false,
    },

    (response, status) => {
      if (status !== google.maps.DistanceMatrixStatus.OK) {
        alert`(Error: ${status})`;
      } else {
        // Get distance value in metres
        const distanceInMetre = response.rows[0].elements[0].distance.value;

        // Change metres to miles and round miles to 2nd decimel point
        const distanceInMile = ((distanceInMetre / 1000) * 0.621371).toFixed(1);

        // Find the time duration
        const travelDuration = response.rows[0].elements[0].duration.text;

        // Find departure address
        const depatureFullAddress = response.originAddresses[0];

        // Find arrival address
        const arrivalFullAddress = response.destinationAddresses[0];

        // Change travel duration in minutes
        let durationInMinute = 0;
        durationInMinute = response.rows[0].elements[0].duration.value / 60;

        // Create object to store data in localstorage
        let travelDetail = {
          originAddress: depatureFullAddress,
          destinationAddress: arrivalFullAddress,
          distanceMetre: distanceInMetre,
          distanceMile: distanceInMile,
          duration: travelDuration,
          durationMinute: durationInMinute,
          date: dateInput.value,
          time: timeInput.value,
          storageTime: new Date().getTime(),
        };

        // Check browser support for Web Storage
        if (typeof Storage !== "undefined") {
          const isStorage = localStorage.getItem("travelInfo");
          if (isStorage === null) {
            localStorage.setItem("travelInfo", JSON.stringify(travelDetail));
            window.location.reload();
          } else {
            localStorage.clear();
            localStorage.setItem("travelInfo", JSON.stringify(travelDetail));
            window.location.reload();
          }
        } else {
          alert("Sorry, your browser does not support Web Storage");
        }
      }
    }
  );
};

// Get local storage data
const journey = JSON.parse(localStorage.getItem("travelInfo"));

// Set expiry time for local storage
window.addEventListener("load", () => {
  let currentTime = new Date().getTime();
  if (journey) {
    let storageStartTime = journey.storageTime;
    let storageDuration = Math.floor((currentTime - storageStartTime) / 60000);
    if (storageDuration >= 60) {
      localStorage.clear();
      window.location.reload();
      journeyDetail.style.display = "none";
      alert("Time out");
    }
  }
});

// Find final fare and display type of services
const url =
  "https://raw.githubusercontent.com/Karan-Satha/fare/master/taxi.json";

const displayServiceInfo = () => {
  fetch(url)
    .then((response) => response.json())
    .then((fare) => {
      const totalFare = fare.map((fare) => {
        const [farePerMinute, farePerMile, baseFare, minimumFare] = [
          fare.farePerMinute,
          fare.farePerMile,
          fare.baseFare,
          fare.minimumFare,
        ];

        if (journey) {
          const finalFare = (
            farePerMinute * journey.durationMinute +
            farePerMile * journey.distanceMile +
            baseFare +
            minimumFare
          ).toFixed(0);
          return `<div class="serviceType">
    <h1 class="fare" id="${fare.id}">£${finalFare}</h1>
    <img class="vehicleImage" src=${fare.imgUrl} />

    <div class="serviceInfo">
    <h1>${fare.carType}</h1>
    <p>${fare.carDescription}</p>
    <div class="buttonContainer">
    <div>
    <i class="fas fa-user-friends"><span> ${fare.person}</span></i>
    <i class="fas fa-suitcase"><span> ${fare.luggage}</span></i>
    </div>
    <button class="selectFareBtn" id=${fare.id} onClick="selectService(this)">SELECT FARE</button>
    </div>
    </div>
    </div>`;
        }
      });

      element("#serviceX").innerHTML = totalFare[0];
      element("#serviceXL").innerHTML = totalFare[1];
      element("#serviceXXL").innerHTML = totalFare[2];
    })
    .catch((error) => {
      alert("Request failed", error);
    });
};

// Display user entered data

const displayTravelInfo = () => {
  // Check session data is available
  if (journey) {
    // Display data
    element("#depatureFullAddress").innerHTML = journey.originAddress;
    element("#arrivalFullAddress").innerHTML = journey.destinationAddress;
    element("#distanceMile").innerHTML = `${journey.distanceMile} miles`;
    element("#duration").innerHTML = journey.duration;
    element("#dateDisplay").innerHTML = new Date(journey.date).toDateString();
    element("#timeDisplay").innerHTML = journey.time;

    displayServiceInfo();
  } else {
    //alert("There is no storage available");
    journeyDetail.style.display = "none";
  }
};

displayTravelInfo();

// Select service type and pass details to next page
const selectService = (button) => {
  // Get JSON file from GitHub using fetch API
  fetch(url)
    .then((response) => response.json())
    .then((fare) => {
      fare.map((service) => {
        if (parseInt(service.id) === parseInt(button.id)) {
          const serviceFare = document.getElementsByClassName("fare")[
            service.id - 1
          ];
          // Get the existing data and add more object properties
          if (journey) {
            journey["fare"] = serviceFare.innerHTML;
            journey["people"] = service.person;
            journey["carType"] = service.carType;
            journey["luggage"] = service.luggage;
            journey["imgUrl"] = service.imgUrl;
            // Update local storage
            localStorage.setItem("travelInfo", JSON.stringify(journey));
            window.location.href =
              "http://localhost:8080/taxi-booking/pages/booking.php";
          }
        }
      });
    })
    .catch((error) => {
      alert("Request failed", error);
    });
};

//Clear textbox on times button click
element("#clearButtonPick").addEventListener(
  "click",
  () => (pickUpLocationInput.value = "")
);

element("#clearButtonDrop").addEventListener(
  "click",
  () => (dropOffLocationInput.value = "")
);

element("#clearButtonDate").addEventListener(
  "click",
  () => (dateInput.value = "")
);

element("#clearButtonTime").addEventListener(
  "click",
  () => (timeInput.value = "")
);

element(".editQuoteBtn").addEventListener("click", () => {
  scrollTo(element(".homeMain"));
  pickUpLocationInput.value = element("#depatureFullAddress").innerHTML;
  dropOffLocationInput.value = element("#arrivalFullAddress").innerHTML;
});
