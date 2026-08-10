Feature: TC02 Book Now Hong Kong login at checkout
  As a member
  I want to start Book Now as a guest and log in at checkout
  So that I can complete payment with my account and save the card for next time

  @TC02 @smoke @book-now @login
  Scenario: TC02 - Book Now then log in at checkout to payment
    Given the application home page is open
    When I search Book Now for Hong Kong International until Book Now is available
    And I click Book Now arrow on the Book Now widget
    And I click Check Out on Book Now flow
    And I log in from guest checkout with configured credentials
    And I complete member checkout for TC02
    And I click Confirm and Proceed for Book Now member flow
    Then I should reach payment, save card for future, and confirm booking for member flow
    And the booking order number should be captured
    And I should see the captured booking in LMS Bookings
