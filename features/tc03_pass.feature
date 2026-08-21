Feature: TC03 Smart Traveller Pass Booking
  As a new guest
  I want to open a Smart Traveller pass, register and activate, then re-select the pass and log in
  So that I can complete member checkout and payment

  @TC03_pass
  Scenario: TC03_pass - Kentico_SmartTraveller_MemberOnly_Pass
    # Launch → Passes → Smart Traveller exclusive → login → register via Yopmail → activate
    Given the application home page is open
    When I select currency "HKD"
    And I click on the Passes on the top menu
    Then I select the member only pass from the list of passes
    Then login window will open
    And I start sign up from the login modal after selecting a product
    And I generate a temporary email via Yopmail
    And I complete new account registration with the generated Email after product selection
    And I verify the account from the Yopmail activation email

    # Passes again → Smart Traveller exclusive → login with Yopmail credentials → checkout
    When I click on the Passes on the top menu
    Then I select the member only pass from the list of passes
    Then login window will open
    And I log in with the newly registered credentials
    And I click Check Out on Book Now flow
    And I complete member checkout for TC02
    And I click Confirm and Proceed for Book Now member flow
    Then I should reach payment and confirm booking for Book Now flow
    And I verify Confirmation page should be displayed with the same product and price that the customer has paid and purchased
    And I redirect to Yopmail and refresh the inbox
    And I should receive a Plaza Premium Lounge Booking Confirmation email in Yopmail with the captured booking id
    And I should receive an Unlock Your PPL Pass email in Yopmail with the captured booking id
