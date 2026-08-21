Feature: TC03 Book Now More at HKG guest checkout
  As a guest
  I want to open More at HKG from Book Now, book a lounge, and pay as a guest
  So that I can complete payment without logging in

  @TC03 @smoke @book-now @guest
  Scenario: TC03 - Book Now More at HKG View lounge guest to payment
    Given the application home page is open
    When I search Book Now for Hong Kong International with defaults
    And I click More at HKG
    And I open lounge View option 4
    And I select lounge duration PRD3352 and get price
    And I click Reserve Now on the lounge booking form
    And I click Check Out on Book Now flow
    And I complete guest checkout for TC03
    And I click Payment for Book Now guest flow
    Then I should reach payment and confirm booking for Book Now flow
    And the booking order number should be captured
    And I should see the captured booking in LMS Bookings
