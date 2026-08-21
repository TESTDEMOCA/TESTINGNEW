Feature: TC01 Book Now guest checkout
  As a guest
  I want to book from the home Book Now widget for supported airports
  So that I can pay for a lounge visit without logging in

  @TC01 @smoke @book-now @guest
  Scenario Outline: TC01 - Book Now arrow guest checkout to payment
    Given the application home page is open
    When I search Book Now for "<destination>" until Book Now is available
    And I click Book Now arrow on the Book Now widget
    And I click Check Out on Book Now flow
    And I complete guest checkout for TC01
    And I click Payment for Book Now guest flow
    Then I should reach payment and confirm booking for Book Now flow
    And the booking order number should be captured
    And I should see the captured booking in LMS Bookings

    Examples:
      | destination | Currency |
      | HKG         | HKD |
      | KUL         | MYR |
      | SIN         | SGD |
