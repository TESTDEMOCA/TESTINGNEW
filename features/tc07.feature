Feature: TC05 Book Now More at HKG shower addon guest checkout
  As a member
 I want to book Hong Kong from the home Book Now widget
  So that I can pay for a lounge visit while logging in

  @TC07 @smoke @book-now 
  Scenario: TC07 - Book Now More at HKG lounge then add Promo code to see discounted payment
    Given the application home page is open
    When I search Book Now for Hong Kong International until Book Now is available
    And I click Book Now arrow on the Book Now widget
    And I add Promo code and check new proce reflected
    And I click Check Out on Book Now flow
    And I log in from guest checkout with configured credentials
    And I complete member checkout for TC02
    And I click Confirm and Proceed for Book Now member flow
    Then I should reach payment and confirm booking for Book Now flow
    And the booking order number should be captured
    And I should see the captured booking in LMS Bookings


