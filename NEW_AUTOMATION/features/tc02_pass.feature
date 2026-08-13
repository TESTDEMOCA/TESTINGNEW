Feature: TC02 Pass Booking Creation
  As a new guest
  I want to sign up with a temporary email, verify it, and book two passes
  So that I can pay for lounge visits as a newly registered member

  @TC02_pass
  Scenario: TC02_pass - Kentico_Member Flow_Pass
    Given the application home page is open
    And I click on the Passes on the top menu
    And I add one pass to the shopping cart
    And I close the mini cart and add one more same pass to the shopping cart
    And I click Check Out on Book Now flow
    And I start sign up from the login modal after selecting a product
    And I generate a temporary email via Yopmail
    And I complete new account registration with the generated Email after product selection
    And I verify the account from the Yopmail activation email
    And I open the login modal at checkout page
    And I log in with the newly registered credentials
    And I complete member checkout for TC02
    And I click Confirm and Proceed for Book Now member flow
    Then I should reach payment and confirm booking for Book Now flow
    And I verify Confirmation page should be displayed with the same product and price that the customer has paid and purchased
    And I redirect to Yopmail and refresh the inbox
    And I should receive a Plaza Premium Lounge Booking Confirmation email in Yopmail with the captured booking id
