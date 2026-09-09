Feature: TC01 Pass Booking Creation
  As a new guest
  I want to sign up with a temporary email, verify it, and book a pass
  So that I can pay for a lounge visit as a newly registered member

  @TC01_pass
  Scenario: TC01_pass - Kentico_GuestFlow_Pass
    Given the application home page is open
    When I select currency "HKD"
    And I click on the Passes on the top menu
    And I add one pass to the shopping cart
    And I click Check Out on Book Now flow
    And I generate a temporary email via Yopmail
    And I complete guest checkout for TC01_Pass
    And I click Payment for Book Now guest flow
    Then I should reach payment and confirm booking for Book Now flow
    And I verify Confirmation page should be displayed with the same product and price that the customer has paid and purchased
    And I redirect to Yopmail and refresh the inbox
    And I should receive a Plaza Premium Lounge Booking Confirmation email in Yopmail with the captured booking id
    And I should receive an Unlock Your PPL Pass email in Yopmail with the captured booking id
