// Short hand to access DOM
const element = (id) => {
  return document.querySelector(id);
};

// Get booking data from local storage
const bookingData = JSON.parse(localStorage.getItem("travelInfo"));

// Access booking data and display
element("#pickAddress").innerHTML = bookingData.originAddress;
element("#dropAddress").innerHTML = bookingData.destinationAddress;
element("#fare").innerHTML = bookingData.fare;
element("#date").innerHTML = new Date(bookingData.date).toDateString();
element("#time").innerHTML = bookingData.time;
element(
  "#car"
).innerHTML = `<img src=".${bookingData.imgUrl}" /> ${bookingData.carType}`;

element(
  "#people"
).innerHTML = `<i class="fas fa-user"></i><i class="fas fa-times"></i>${bookingData.people}`;
element(
  "#luggage"
).innerHTML = `<i class="fas fa-suitcase"></i><i class="fas fa-times"></i> ${bookingData.luggage}`;

// Assign booking data values to hidden input fields

element("#pickUp").value = bookingData.originAddress;
element("#dropOff").value = bookingData.destinationAddress;
element("#pickDate").value = bookingData.date;
element("#pickTime").value = bookingData.time;
element("#carType").value = bookingData.carType;
element("#tripFare").value = bookingData.fare.slice(1);
element("#luggageNo").value = bookingData.luggage;

// Create an object to store error messages
const errorMsg = {
  emptyName: "Please enter your name",
  invalidName: "Name must contain letters and space only",
  emptyEmail: "Please enter your email address",
  invalidEmail: "Invalid email address",
  emptyPhone: "Please enter your phone number",
  invalidPhone: "Invalid phone number",
  emptyPassanger: "Please select the number of passanger",
  invalidPassanger: "Number of passangers must not exceed",
};

const regEx = {
  name: /[^a-zA-Z\s]/g,
  email: /\S+@\S+\.\S+/,
  phone: /^[7]\d{8,9}$/,
};

// Handle input data
const handler = (event) => {
  let input = event.target;
  let error = input.nextElementSibling.lastElementChild;
  let noOfPass = input.value.split(" ");

  // Add CSS to input fields on focus
  let addOnFocus = () => {
    input.classList.remove("error");
    input.classList.add("focus");
    input.nextElementSibling.style.display = "none";
    input.style.marginBottom = "15px";
  };

  // Add CSS to input fields on focusout
  let addFocusOut = () => {
    input.classList.add("error");
    input.nextElementSibling.style.display = "block";
    input.style.marginBottom = "0px";
  };

  // Add focus class on focus
  if (event.type == "focus") {
    addOnFocus();

    // Check name on focusout
  } else if (event.type == "blur") {
    if (input.value == "" && input.id == "name") {
      addFocusOut();
      error.innerHTML = errorMsg.emptyName;
    } else if (input.id == "name" && input.value.match(regEx.name)) {
      addFocusOut();
      error.innerHTML = errorMsg.invalidName;

      // Check email on focusout
    } else if (input.value == "" && input.id == "email") {
      addFocusOut();
      error.innerHTML = errorMsg.emptyEmail;
    } else if (input.id == "email" && !input.value.match(regEx.email)) {
      addFocusOut();
      error.innerHTML = errorMsg.invalidEmail;

      // Check phone number on focusout
    } else if (input.value == "" && input.id == "phone") {
      addFocusOut();
      error.innerHTML = errorMsg.emptyPhone;
    } else if (input.id == "phone" && !input.value.match(regEx.phone)) {
      addFocusOut();
      error.innerHTML = errorMsg.invalidPhone;

      // Check passanger number on focusout
    } else if (
      input.id == "passanger" &&
      input.value === "--Select passanger--"
    ) {
      addFocusOut();
      error.innerHTML = errorMsg.emptyPassanger;
    } else if (input.id == "passanger" && noOfPass[0] > bookingData.people) {
      addFocusOut();
      error.innerHTML = `${errorMsg.invalidPassanger} ${bookingData.people}`;
    } else {
      input.classList.remove("focus");
    }
  }
};

// Add event handler to input fields
document.querySelectorAll(".userInputBook").forEach((input) => {
  input.addEventListener("focus", handler);
  input.addEventListener("blur", handler);
});

// Change color of personal of progress bar
const activatePersonal = () => {
  element("#activePersonalCircle").style.backgroundColor = "#00ab66";
  element("#activePersonalLine").style.backgroundColor = "#00ab66";
  element("#activePersonalCircle").innerHTML = `<i class="fas fa-check"></i>`; 
};

// Remove color of personal of progress bar
const removePersonal = () => {
  element("#activePersonalCircle").style.backgroundColor = "#e5e5e5";
  element("#activePersonalLine").style.backgroundColor = "#e5e5e5";
  element("#activePersonalCircle").innerHTML = "2";
};

// Change color of payment of progress bar
const activatePayment = () => {
  element("#activePaymentCircle").style.backgroundColor = "#00ab66";
  element("#activePaymentLine").style.backgroundColor = "#00ab66";
  element("#activePaymentCircle").innerHTML = `<i class="fas fa-check"></i>`;
};

// Remove color of payment of progress bar
const removePayment = () => {
  element("#activePaymentCircle").style.backgroundColor = "#e5e5e5";
  element("#activePaymentLine").style.backgroundColor = "#e5e5e5";
  element("#activePaymentCircle").innerHTML = "3";
};

window.onscroll = () => {
  stickProgressBar();
};

// Fix progress bar
const stickProgressBar = () => {
  let header = element(".checkMain");
  let sticky = header.offsetTop;
  if (window.pageYOffset > sticky) {
    header.classList.add("sticky");
  } else {
    header.classList.remove("sticky");
  }
};

// Disable payment options
document.querySelectorAll(".userInputBook").forEach((input) => {
  let name = element("#name");
  let email = element("#email");
  let phone = element("#phone");
  let passanger = element("#passanger");

  input.addEventListener("blur", () => {
    if (
      name.value === "" ||
      email.value === "" ||
      phone.value === "" ||
      passanger.value === "--Select passanger--"
    ) {
      disableRadioBtn();
      removePersonal();
    } else if (
      name.value.match(regEx.name) ||
      !email.value.match(regEx.email) ||
      !phone.value.match(regEx.phone)
    ) {
      disableRadioBtn();
      removePersonal();
    } else {
      enableRadioBtn();
      activatePersonal();
    }
  });
});

// Remove payment error message
document.querySelectorAll("input[name='payment']").forEach((event) => {
  event.addEventListener("click", () => {
    let paymentError = element("#payErrorMsg");
    let cash = element("#cash");
    let creditCard = element("#creditCard");
    let payPal = element("#payPal");
    let paymentId = element("#paymentId");
    if (cash.checked || creditCard.checked || payPal.checked) {
      paymentError.style.display = "none";
      activatePayment();
    }
  });
});

// Validate user input on submit
element("#bookingForm").addEventListener("submit", (event) => {
  let name = element("#name");
  let email = element("#email");
  let phone = element("#phone");
  let passanger = element("#passanger");
  let paymentError = element("#payErrorMsg");
  let cash = element("#cash");
  let creditCard = element("#creditCard");
  let payPal = element("#payPal");
  let noOfPass = passanger.value.split(" ");

  // Add CSS to input fields
  let displayError = (input) => {
    return [
      input.classList.add("error"),
      (input.nextElementSibling.style.display = "block"),
      (input.style.marginBottom = "0px"),
    ];
  };

  // Check name
  if (name.value === "") {
    displayError(name);
    name.nextElementSibling.lastElementChild.innerHTML = errorMsg.emptyName;
    event.preventDefault();
  } else {
    if (name.value.match(regEx.name)) {
      displayError(name);
      name.nextElementSibling.lastElementChild.innerHTML = errorMsg.invalidName;
      event.preventDefault();
    }
  }

  // Check email
  if (email.value === "") {
    displayError(email);
    email.nextElementSibling.lastElementChild.innerHTML = errorMsg.emptyEmail;
    event.preventDefault();
  } else {
    if (!email.value.match(regEx.email)) {
      displayError(email);
      email.nextElementSibling.lastElementChild.innerHTML =
        errorMsg.invalidEmail;
      event.preventDefault();
    }
  }

  // Check phone number
  if (phone.value === "") {
    displayError(phone);
    phone.nextElementSibling.lastElementChild.innerHTML = errorMsg.emptyPhone;
    event.preventDefault();
  } else {
    if (!phone.value.match(regEx.phone)) {
      displayError(phone);
      phone.nextElementSibling.lastElementChild.innerHTML =
        errorMsg.invalidPhone;
      event.preventDefault();
    }
  }

  // Check passanger number
  if (passanger.value === "--Select passanger--") {
    displayError(passanger);
    passanger.nextElementSibling.lastElementChild.innerHTML =
      errorMsg.emptyPassanger;
    event.preventDefault();
  } else {
    if (noOfPass[0] > bookingData.people) {
      displayError(passanger);
      passanger.nextElementSibling.lastElementChild.innerHTML = `${errorMsg.invalidPassanger} ${bookingData.people}`;
      event.preventDefault();
    }
  }

  // Check payment
  if (cash.checked || creditCard.checked) {
    return true;
  } else if (payPal.checked) {
    if (element("#paymentId").value === "") {
      paymentError.style.display = "block";
      paymentError.lastElementChild.textContent =
        "PayPal payment is incomplete";
      event.preventDefault();
    } else {
      return true;
    }
  } else {
    paymentError.style.display = "block";
    paymentError.lastElementChild.textContent =
      "Please select a payment option";
    event.preventDefault();
  }

  return true;
});

// Get country code from gitHub using fetch API
const codeUrl =
  "https://raw.githubusercontent.com/Karan-Satha/country-code/master/code.json";

fetch(codeUrl)
  .then((response) => response.json())
  .then((code) => {
    code.forEach((code) => {
      let dataList = element("#codes");
      let option = document.createElement("option");
      option.value = `${code.code} - ${code.name}`;
      dataList.appendChild(option);
    });
  })
  .catch((error) => {
    alert("Request failed", error);
  });

// Get only country code number from dropdown on selection
element("#code").addEventListener("change", (event) => {
  let code = event.target.value.split(" ");
  event.target.value = code[0];
});

// Add number of passangers to dropdown
for (let i = 2; i <= 15; i++) {
  let passanger = element("#passanger");
  passanger.add(new Option(`${i} Passangers`));
}

// Clear country code value on focus
element("#code").addEventListener("focus", (event) => {
  event.target.value = "";
});

// Make UK as default code
element("#code").addEventListener("focusout", (event) => {
  if (event.target.value == "") {
    event.target.value = "+44";
  }
});

// Hide panel under payment options
const hidePanel = () => {
  document.querySelectorAll(".panel").forEach((pan) => {
    pan.style.height = "0px";
  });
};

// Add plus icon next to payment options
const addPlus = () => {
  document.querySelectorAll("#plus").forEach((plus) => {
    plus.classList.add("fa-plus");
  });
};

// Disable payment radio buttons
const disableRadioBtn = () => {
  document.querySelectorAll("input[type='radio']").forEach((event) => {
    if (event.checked) {
      event.disabled = false;
    } else {
      event.disabled = true;
      event.title = "This option is disabled. Please fill all required fields";
      hidePanel();
      addPlus();
    }
  });
};
disableRadioBtn();

const enableRadioBtn = () => {
  document.querySelectorAll("input[type='radio']").forEach((event) => {
    event.disabled = false;
    event.title = "";
  });
};

// Show panel on payment radio button click
document.querySelectorAll("input[type='radio']").forEach((event) => {
  event.addEventListener("click", function (radio) {
    let panel = radio.target.parentElement.nextElementSibling;
    let icon = radio.target.parentElement.lastElementChild;

    hidePanel();
    addPlus();

    icon.classList.remove("fa-plus");
    icon.classList.add("fa-minus");
    panel.style.height = "100px";
  });
});

// Integrate payPal
let totalFare = bookingData.fare.slice(1);
paypal.Button.render(
  {
    // Configure environment
    env: "sandbox",
    client: {
      sandbox:
        "Aep41JbvpBA_v9G6_2LYxSoMACL6BsjsfIBa4e6_nhCFAPYTOVUGCu84t9ieniCT9mWq3eyxRYJeCaCL",
      production: "demo_production_client_id",
    },
    // Customize button (optional)
    locale: "en_US",
    style: {
      size: "responsive",
      color: "gold",
      shape: "rect",
      label: "pay",
    },

    // Enable Pay Now checkout flow (optional)
    commit: true,

    // Set up a payment
    payment: function (data, actions) {
      return actions.payment.create({
        transactions: [
          {
            amount: {
              total: totalFare,
              currency: "GBP",
            },
          },
        ],
      });
    },
    // Execute the payment
    // onAuthorize: function (data, actions) {
    //   return actions.payment.execute().then(function (details) {
    //     // Show a confirmation message to the buyer
    //     window.alert("Thank you for your purchase!");
    //     element("#paymentSuccess").innerHTML =
    //       "We have successfully recieved your payment ";
    //   });
    // },

    onAuthorize: function (data, actions) {
      // Get the payment details
      return actions.payment.get().then(function (paymentDetails) {
        // Show a confirmation using the details from paymentDetails
        element("#paymentId").value = paymentDetails.id;
        element("#payerId").value = paymentDetails.payer.payer_info.payer_id;
        element(
          "#payerName"
        ).value = `${paymentDetails.payer.payer_info.first_name} ${paymentDetails.payer.payer_info.last_name}`;
        element("#paidAmount").value =
          paymentDetails.transactions[0].amount.total;
        element("#paidAt").value = paymentDetails.create_time;

        // Then listen for a click on your confirm button
        document
          .querySelector(".bookNowBtn")
          .addEventListener("click", function () {
            // Execute the payment
            return actions.payment.execute().then(function () {
              // Show a success page to the buyer
              element("#paymentSuccess").innerHTML =
                "We have successfully recieved your payment ";
            });
          });
      });
    },
    onCancel: function (data, actions) {
      return alert("You have cancelled the payment");
    },
    onError: function (error) {
      return alert(error);
    },
  },
  "#paypal-button-container"
);
