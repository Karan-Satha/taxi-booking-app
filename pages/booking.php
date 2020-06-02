<?php

include "../config/connect.php";
$name = $email = $phone = $passanger = $paymentId = $payerId = $paidAmount = '';
$errors = ['name' => '', 'email' => '', 'phone' => '', 'passanger' => '', 'paymentid' => '', 'payerid' => '', 'paidamount' => '', 'payment' => ''];
if (isset($_POST["submit"])) {

    // echo htmlspecialchars($_POST["code"]);
    // echo htmlspecialchars($_POST["note"]);
    // echo htmlspecialchars($_POST["payment"]);
    // echo htmlspecialchars($_POST["pickup"]);
    // echo htmlspecialchars($_POST["dropoff"]);
    // echo htmlspecialchars($_POST["date"]);
    // echo htmlspecialchars($_POST["time"]);
    // echo htmlspecialchars($_POST["fare"]);
    // echo htmlspecialchars($_POST["car"]);
    // echo htmlspecialchars($_POST["luggage"]);

    // Check name
    if (empty($_POST["name"])) {
        $errors['name'] = "Please enter your name";
    } else {
        $name = $_POST["name"];
        if (preg_match('/[^a-zA-Z\s]/', $name)) {
            $errors['name'] = "Name must contain letters and space only";
        }
    }
    // Check email
    if (empty($_POST["email"])) {
        $errors['email'] = "Please enter your email address";
    } else {
        $email = $_POST["email"];
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = "Incorrect email format";
        }
    }
    // Check phone
    if (empty($_POST["phone"])) {
        $errors['phone'] = "Please enter your phone  number";
    } else {
        $phone = $_POST["phone"];
        if (!preg_match('/^\d{8,12}$/', $phone)) {
            $errors['phone'] = "Invalid phone number";
        }
    }
    // Check passanger
    if (isset($_POST["passanger"]) === "--Select passanger--") {
        $errors['passanger'] = "Please select the number of passanger";
    }

    // Check payment
    if (!isset($_POST["payment"])) {
        $errors['payment'] = "Please select the payment option";
    }

    if (isset($_POST["payment"]) === "payPal") {
        // Check paypal payment id
        if (empty($_POST["paymentId"])) {
            $errors["paymentid"] = "payment process is incomplete";
        }

        // Check paypal payer id
        if (empty($_POST["payerId"])) {
            $errors["payerid"] = "payment process is incomplete";
        }

        // Check paypal payment amount
        if (empty($_POST["paidAmount"])) {
            $errors["paidamount"] = "payment process is incomplete";
        }
    }

    if (array_filter($errors)) {
        echo ("error in the form");
    } else {
        $name = mysqli_real_escape_string($conn, $_POST["name"]);
        $email = mysqli_real_escape_string($conn, $_POST["email"]);
        $code = mysqli_real_escape_string($conn, $_POST["code"]);
        $phone = mysqli_real_escape_string($conn, $_POST["phone"]);
        $passanger = mysqli_real_escape_string($conn, $_POST["passanger"]);
        $luggage = mysqli_real_escape_string($conn, $_POST["luggage"]);
        $note = mysqli_real_escape_string($conn, $_POST["note"]);
        $paymentMethod = mysqli_real_escape_string($conn, $_POST["payment"]);
        $pickup = mysqli_real_escape_string($conn, $_POST["pickup"]);
        $dropoff = mysqli_real_escape_string($conn, $_POST["dropoff"]);
        $date = mysqli_real_escape_string($conn, $_POST["date"]);
        $time = mysqli_real_escape_string($conn, $_POST["time"]);
        $carType = mysqli_real_escape_string($conn, $_POST["car"]);
        (int) $fare = mysqli_real_escape_string($conn, $_POST["fare"]);

        // Paypal payment

        $paymentId = mysqli_real_escape_string($conn, $_POST["paymentId"]);
        $payerId = mysqli_real_escape_string($conn, $_POST["payerId"]);
        $payerName = mysqli_real_escape_string($conn, $_POST["payerName"]);
        $paidAmount = mysqli_real_escape_string($conn, $_POST["paidAmount"]);
        $paidAt = mysqli_real_escape_string($conn, $_POST["paidAt"]);

        // Create sql

        // Store data and check
        //mysqli_query($conn, $customer);
        // mysqli_query($conn, $vehicle);
        // mysqli_query($conn, $booking);
        //mysqli_query($conn, $payment1);
        $codeAndPhone = $code . "-" . $phone;
        $customer = "INSERT INTO customer_tbl(name, email, phone) VALUES('$name', '$email', '$codeAndPhone')";
        // if (mysqli_query($conn, $customer)) {
        //     echo "data stored";
        // } else {
        //     echo "failed to store data" . mysqli_error($conn);
        // }

        $result = mysqli_query($conn, $customer);
        // Retrieve last customer id
        $user_id = mysqli_insert_id($conn);
        if (isset($result) && is_resource($result)) {
            mysqli_free_result($result);
        }

        $booking = "INSERT INTO booking_tbl(customer_id, pickup_address, dropoff_address, journey_date, journey_time, customer_note) VALUES('$user_id','$pickup', '$dropoff', '$date', '$time', '$note')";
        // if (mysqli_query($conn, $booking)) {
        //     echo "data stored";
        // } else {
        //     echo "failed to store data" . mysqli_error();
        // }

        $result = mySqli_query($conn, $booking);
        // Retrieve last booking id
        $book_id = mysqli_insert_id($conn);
        if (isset($result) && is_resource($result)) {
            mysqli_free_result($result);
        }

        $vehicle = "INSERT INTO vehicle_tbl(booking_id, vehicle_type, passanger,luggage) VALUES('$book_id','$carType', '$passanger', '$luggage')";
        // if (mysqli_query($conn, $vehicle)) {
        //     echo "data stored";
        // } else {
        //     die("failed to store data" . mysqli_error($conn));
        // }

        $result = mysqli_query($conn, $vehicle);
        // Retrieve last booking id
        $pay_id = mysqli_insert_id($conn);
        if (isset($result) && is_resource($result)) {
            mysqli_free_result($result);
        }

        $payment = "INSERT INTO payment_tbl(customer_id, booking_id, payment_method, amount) VALUES('$user_id','$book_id','$paymentMethod', '$fare')";
        // if (mysqli_query($conn, $payment1)) {
        //     echo "data stored";
        // } else {
        //     echo "failed to store data" . mysqli_error();
        // }
        $result = mysqli_query($conn, $payment);
        if (isset($result) && is_resource($result)) {
            mysqli_free_result($result);
        }

        if (isset($_POST["payment"]) === "payPal") {
            $paypalPayment = "INSERT INTO paypal_payment_tbl(paypal_payment_id, payment_id, payer_id, payer_name, paid_amount, paid_at) VALUES('$paymentId','$pay_id','$payerId','$payerName','$paidAmount','$paidAt')";
            $result = mysqli_query($conn, $paypalPayment);
            if (isset($result) && is_resource($result)) {
                mysqli_free_result($result);
            }
        }
    }
}
?>

<!DOCTYPE html>
<html>

<head>
    <?php include "../templates/head.php";?>
    <link rel="stylesheet" href="../stylesheets/booking.css" />
    <link rel="stylesheet" href="../stylesheets/taxihome.css" />
</head>

<body>

    <section>
        <article>
            <?php include "../templates/header.php";?>
        </article>
    </section>
    <section class="checkMain">
        <div class="checkMainLine">
            <div class="checkStatus">
                <div class="checkCircle"><i class="fas fa-check"></i></i></div>
                <div class="checkLine"></div>
                <p>Trip</p>
            </div>
            <div class="checkStatus">
                <div class="checkCircle" id="activePersonalCircle">2</div>
                <div class="checkLine" id="activePersonalLine"></div>
                <p>Personal</p>
            </div>
            <div class="checkStatus">
                <div class="checkCircle" id="activePaymentCircle">3</div>
                <div class="checkLine" id="activePaymentLine"></div>
                <p>Payment</p>
            </div>
            <div class="checkStatus">
                <div class="checkCircle" id="activeConfirmCircle">4</div>
                <div class="checkLine" id="activeConfirmLine"></div>
                <p>Complete</p>
            </div>
        </div>
    </section>
    <main class="bookingMain">
        <div></div>
        <section class="journeyInfo">
            <div class="heading">
                <h2>Journey Details</h2>
            </div>
            <div class="journeyInfoDetail">
                <label>From</label>
                <div id="pickAddress"></div>
            </div>
            <div class="journeyInfoDetail">
                <label>To</label>
                <div id="dropAddress"></div>
            </div>
            <div class="journeyInfoDetail">
                <label>Date</label>
                <div id="date"></div>
            </div>
            <div class="journeyInfoDetail">
                <label>Time</label>
                <div id="time"></div>
            </div>
            <div class="journeyInfoDetail">
                <label>Fare</label>
                <div id="fare"></div>
            </div>
            <div class="journeyInfoDetail">
                <h2>Vehicle Details</h2>
            </div>
            <div class="journeyInfoDetail">
                <label>Car Type</label>
                <div id="car"></div>
            </div>
            <div class="journeyInfoDetail">
                <label>Passangers</label>
                <div id="people"></div>
            </div>
            <div class="journeyInfoDetail">
                <label>Luggage</label>
                <div id="luggage"></div>
            </div>
        </section>
        <section class="userInfo">

            <div class="heading">
                <h2>Passanger Details</h2>
            </div>
            <form action="booking.php" method="POST" id="bookingForm">
                <div class="inputContainer">
                    <div>
                        <label>Full Name</label>
                    </div>
                    <input type="text" class="userInputBook" id="name" name="name" placeholder="e.g: Joe Smith" />
                    <div class="errorMsg">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p></p>
                    </div>
                </div>

                <div class="inputContainer">
                    <div>
                        <label>E-mail</label>
                    </div>
                    <input type="text" class="userInputBook" id="email" name="email" placeholder="e.g: joe@gmail.com" />
                    <div class="errorMsg">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p></p>
                    </div>
                </div>

                <div class="inputContainer">
                    <div>
                        <label>Phone Number</label>
                    </div>
                    <input type="text" list="codes" class="countryCode" id="code" value="+44" name="code" />
                    <datalist id="codes">
                    </datalist>
                    <input type="text" class="userInputBook" id="phone" name="phone" placeholder="e.g: 7466775500" />
                    <div class="errorMsg">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p></p>
                    </div>
                </div>

                <div class="inputContainer">
                    <div>
                        <label>Passanger</label>
                    </div>
                    <select type="text" class="userInputBook" id="passanger" name="passanger">
                        <option>--Select passanger--</option>
                        <option>1 Passanger</option>
                    </select>
                    <div class="errorMsg">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p></p>
                    </div>
                </div>

                <div class="inputContainer">
                    <div>
                        <label>Notes (optional)</label>
                    </div>
                    <textarea id="note" name="note" placeholder="e.g: Car seat for a toddler"></textarea>
                </div>

                <div class="inputContainer" id="payment">

                    <div>
                        <h2>Payment Methods</h2>
                    </div>

                    <div class="selectMethod">
                        <input type="radio" name="payment" id="cash" value="cash" />
                        <label class="label" for="cash">Cash</label>
                        <i class="fas fa-plus" id="plus"></i>
                    </div>
                    <div class="panel">
                        <p>Please pay to the driver</p>
                    </div>
                    <div class="selectMethod">
                        <input type="radio" name="payment" id="creditCard" value="creditCard" />
                        <label class="label" for="creditCard">Credit Card</label>
                        <i class="fas fa-plus" id="plus"></i>
                    </div>
                    <div class="panel">
                        <p>We do not currently accept card payment. Please pay by cash.</p>
                    </div>
                    <div class="selectMethod">
                        <input type="radio" name="payment" id="payPal" value="payPal" />
                        <label class="label" for="payPal">Paypal</label>
                        <i class="fas fa-plus" id="plus"></i>
                    </div>
                    <div class="panel">
                        <!-- <p>We do not currently accept Paypal payment. Please pay by cash.</p> -->
                        <div id="paypal-button-container"></div>
                    </div>
                    <div class="errorMsg" id="payErrorMsg">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p></p>
                    </div>
                </div>

                <!-- Journey details -->
                <input type="hidden" name="pickup" id="pickUp" />
                <input type="hidden" name="dropoff" id="dropOff" />
                <input type="hidden" name="date" id="pickDate" />
                <input type="hidden" name="time" id="pickTime" />
                <input type="hidden" name="car" id="carType" />
                <input type="hidden" name="fare" id="tripFare" />
                <input type="hidden" name="luggage" id="luggageNo" />
                <!-- PayPal payment details -->
                <input type="hidden" name="paymentId" id="paymentId" />
                <input type="hidden" name="payerId" id="payerId" />
                <input type="hidden" name="payerName" id="payerName" />
                <input type="hidden" name="paidAmount" id="paidAmount" />
                <input type="hidden" name="paidAt" id="paidAt" />

                <input type="submit" name="submit" class="bookNowBtn" value="BOOK NOW" />
            </form>

        </section>
    </main>
    <!-- <script
        src="https://www.paypal.com/sdk/js?client-id=Aep41JbvpBA_v9G6_2LYxSoMACL6BsjsfIBa4e6_nhCFAPYTOVUGCu84t9ieniCT9mWq3eyxRYJeCaCL&currency=GBP">

    </script> -->
    <script src="https://www.paypalobjects.com/api/checkout.js"></script>
    <script src="../scripts/booking.js"></script>
</body>

</html>