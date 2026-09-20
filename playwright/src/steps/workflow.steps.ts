import { DataTable } from 'playwright-bdd';
import { Then, When } from '../fixtures';
import { columnValues } from '../helpers/data-table';

When('I validate the request', async ({ pages }) => {
    await pages.workflow.validate();
});

Then('I should see no validation issues', async ({ pages }) => {
    await pages.workflow.expectNoValidationIssues();
});

When('I submit the request for approval', async ({ pages }) => {
    await pages.workflow.submitForApproval();
});

When('I open the created request', async ({ pages }) => {
    await pages.workflow.openCreatedRequest();
});

When('I wait for the Perform EQM Approval action', async ({ pages }) => {
    await pages.workflow.waitForEqmApprovalAction();
});

When(
    'I perform EQM approval with comment {string}',
    async ({ world, pages }, comment: string) => {
        await pages.workflow.performEqmApproval(
            comment,
            world.data?.approval.checkboxes ?? []
        );
    }
);

When(
    'I perform EQM approval with comment {string} for:',
    async ({ pages }, comment: string, table: DataTable) => {
        await pages.workflow.performEqmApproval(comment, columnValues(table));
    }
);

Then(
    'the request should progress past pending EQM approval',
    async ({ pages }) => {
        await pages.workflow.expectPastPendingEqm();
    }
);
