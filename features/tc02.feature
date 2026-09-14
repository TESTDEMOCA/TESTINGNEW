Feature: TC02 Book Now Hong Kong login at checkout
  As a member
  I want to start Book Now as a guest and log in at checkout
  So that I can complete payment with my account and save the card for next time

  @TC02 @smoke @book-now @login
  Scenario: TC02 - Book Now then log in at checkout to payment
    Given the application home page is open
    When I select currency "HKD"
    And I search Book Now for Hong Kong International until Book Now is available
    And I click Book Now arrow on the Book Now widget
    And I click Check Out on Book Now flow
    And I log in from guest checkout with configured credentials
    And I complete member checkout for TC02
    And I click Confirm and Proceed for Book Now member flow
    Then I should reach payment, save card for future, and confirm booking for member flow
    And the booking order number should be captured
    And I fetch the AMS order summary for the captured booking id
    And I log in to LMS
    And I open LMS Masters
    And I click Outlet under LMS Masters
    And I search LMS Outlet with the captured AMS order number
    And I capture the LMS outlet name from the Outlet search result
    And I open LMS Bookings
    And I select the captured LMS outlet
    Then I should see the captured booking in LMS Bookings
