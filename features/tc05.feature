Feature: TC05 Book Now More at HKG shower addon guest checkout
  As a member
  I want to book a lounge via More at HKG and add Shower 30 mins on the cart
  So that I can complete payment with logging in

  @TC05 @smoke @book-now 
  Scenario: TC05 - Book Now More at HKG lounge then add Shower  to payment
    Given the application home page is open
    When I search Book Now for Hong Kong International with defaults
    And I click More at HKG
    And I open lounge View option 4
    And I click Get Price leaving Services defaults
    And I click Reserve Now on the lounge booking form
    And I add Shower 30 mins addon on the cart
    And I click Check Out on Book Now flow
    And I log in from guest checkout with configured credentials
    And I complete member checkout for TC02
    And I click Confirm and Proceed for Book Now member flow
    Then I should reach payment and confirm booking for Book Now flow
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