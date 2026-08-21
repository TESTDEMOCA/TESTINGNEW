Feature: Locations Hong Kong booking
  As a traveller
  I want to book Plaza Premium Lounge near Gate 60 in Hong Kong
  So that I can complete checkout as a logged-in member or as a guest

  Background:
    Given the application home page is open

  @smoke @locations @QA-HKG @QA-HKG-LOGIN @login
  Scenario: Login flow - Hong Kong HKG booking with member checkout
    When I open the login modal
    And I sign in with configured credentials
    Then I should be logged in
    When I open the Locations menu
    And I select the Hong Kong SAR country tab
    And I select the Hong Kong HKG city
    Then I should see the Hong Kong Kowloon High Speed Rail Terminal title
    When I open Plaza Premium Lounge departures near gate sixty
    Then I should see the Book your visit header
    And the lounge booking form should be visible
    When I fill the lounge booking form with defaults
    And I click Get Price on the lounge booking form
    And I click Reserve Now on the lounge booking form
    And I click Check Out
    Then the member checkout form should be visible
    When I fill the member checkout form with country and contact number
    And I accept the checkout privacy policy and terms
    And I click Confirm and Proceed
    Then I should see the Payment Method page
    When I fill the payment card details with defaults
    And I click Confirm and Pay
    Then I should see the Booking Confirmed page
    And the booking order number should be captured
    And I should see the captured booking in LMS Bookings

  @smoke @locations @QA-HKG @QA-HKG-GUEST @guest
  Scenario: Guest flow - Hong Kong HKG booking with guest checkout
    When I open the Locations menu
    And I select the Hong Kong SAR country tab
    And I select the Hong Kong HKG city
    Then I should see the Hong Kong Kowloon High Speed Rail Terminal title
    When I open Plaza Premium Lounge departures near gate sixty
    Then I should see the Book your visit header
    And the lounge booking form should be visible
    When I fill the lounge booking form with defaults
    And I click Get Price on the lounge booking form
    And I click Reserve Now on the lounge booking form
    And I click Check Out
    Then the guest checkout form should be visible
    When I fill the guest checkout form with defaults
    And I accept the guest checkout privacy policy and terms
    And I click Payment
    Then I should see the Payment Method page
    When I fill the payment card details with defaults
    And I click Confirm and Pay
    Then I should see the Booking Confirmed page
    And the booking order number should be captured
    And I should see the captured booking in LMS Bookings
