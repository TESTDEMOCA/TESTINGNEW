Feature: TC06 Gate 35 More at HKG upgrade to PPF guest checkout
  As a guest
  I want to book Gate 35 via More at HKG, upgrade to PPF, add an addon, and pay
  So that I can complete a Plaza Premium First guest booking

  @TC06 @smoke @book-now @guest @gate35
  Scenario: TC06 - Gate 35 More at HKG View upgrade PPF addon guest to payment
    Given the application home page is open
    When I search Book Now for "HKG" until Gate "35" lounge is available
    And I click More at HKG
    And I select Gate "35" on the lounge listing
    And I open Plaza Premium Lounge View for Gate "35"
    And I click Get Price leaving Services defaults
    And I click Reserve Now on the lounge booking form
    And I click Upgrade and expect PPF in the cart
    And I add Shower 30 mins addon on the cart
    And I click Check Out on Book Now flow
    And I complete guest checkout for TC03
    And I click Payment for Book Now guest flow
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
