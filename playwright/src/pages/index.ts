import { requireUser } from '../helpers/credentials';
import type { World } from '../fixtures/world';
import { ClientDetailsPage } from './ClientDetailsPage';
import { ConfigurationPage } from './ConfigurationPage';
import { DashboardPage } from './DashboardPage';
import { LoginPage } from './LoginPage';
import { RequestDetailsPage } from './RequestDetailsPage';
import { RequestWorkflowPage } from './RequestWorkflowPage';

export class Pages {
    readonly login: LoginPage;
    readonly dashboard: DashboardPage;
    readonly request: RequestDetailsPage;
    readonly client: ClientDetailsPage;
    readonly configuration: ConfigurationPage;
    readonly workflow: RequestWorkflowPage;

    constructor(world: World) {
        this.login = new LoginPage(world);
        this.dashboard = new DashboardPage(world);
        this.request = new RequestDetailsPage(world);
        this.client = new ClientDetailsPage(world);
        this.configuration = new ConfigurationPage(world);
        this.workflow = new RequestWorkflowPage(world);
    }

    async loginAs(userKey: string): Promise<void> {
        const user = requireUser(userKey);
        await this.login.open();
        await this.login.login(user.username, user.password);
        await this.dashboard.expectLoaded();
    }
}
