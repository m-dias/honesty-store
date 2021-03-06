import { DynamoDB } from 'aws-sdk';
import * as winston from 'winston';
import { ensureDomainName, ensureLambdaMethod, ensureResource, ensureRestApi, ensureStagedDeployment } from '../apigateway/gateway';
import { ensureStreamingDB, ensureTable } from '../dynamodb/table';
import { ensureFunction, ensureFunctionDynamoTrigger } from '../lambda/function';
import { aliasToBaseUrl, ensureAlias } from '../route53/alias';
import dirToTable from '../table/tables';

export const prefix = 'hs';

interface LambdaConfig {
  [key: string]: {
    database?: 'ro' | 'rw';
    handler: string;
    codeFilter: string;
    timeout: number;

    withStripe?: boolean;
    withUserSecret?: boolean;
    exposeOnGateway?: boolean;

    catchAllResource?: boolean;

    watchedTableNames?: string[];
  };
}

const lambdaConfig: LambdaConfig = {
  item: {
    database: 'rw',
    handler: 'lib/bundle-min.handler',
    codeFilter: 'lib/bundle-min.js',
    timeout: 10
  },
  store: {
    database: 'rw',
    handler: 'lib/bundle-min.handler',
    codeFilter: 'lib/bundle-min.js',
    timeout: 10
  },
  transaction: {
    database: 'rw',
    handler: 'lib/bundle-min.handler',
    codeFilter: 'lib/bundle-min.js',
    timeout: 10
  },
  topup: {
    database: 'rw',
    handler: 'lib/bundle-min.handler',
    codeFilter: 'lib/bundle-min.js',
    withStripe: true,
    timeout: 30
  },
  user: {
    database: 'rw',
    handler: 'lib/bundle-min.handler',
    codeFilter: 'lib/bundle-min.js',
    withUserSecret: true,
    timeout: 10
  },
  api: {
    handler: 'lib/bundle-min.handler',
    codeFilter: 'lib/bundle-min.js',
    timeout: 30,
    exposeOnGateway: true
  },
  web: {
    handler: 'server/lambda.handler',
    codeFilter: '{node_modules,server,build}/**/*',
    catchAllResource: true,
    timeout: 10,
    exposeOnGateway: true
  },
  ['transaction-store']: {
    handler: 'lib/bundle-min.handler',
    codeFilter: 'lib/bundle-min.js',
    timeout: 10,
    watchedTableNames: [
      'transaction'
    ]
  }
};

const isLive = (branch) => branch === 'live';

const generateName = ({ branch, dir }: { branch: string, dir?: string }) => {
  const base = isLive(branch) ? 'honesty-store' : `${prefix}-${branch}`;
  return dir == null ? base : `${base}-${dir}`;
};

const ensureDatabase = async ({ branch, dir }) => {
  const capacityUnits = 1;

  const { config, data } = dirToTable({
    dir,
    readCapacityUnits: capacityUnits,
    writeCapacityUnits: capacityUnits
  });
  return await ensureTable({
    config: {
      ...config,
      TableName: generateName({ branch, dir })
    },
    data
  });
};

const getAndAssertEnvironment = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`$${key} not present in environment`);
  }
  return value;
};

const generateStripeKey = ({ branch, type }) => {
  if (isLive(branch) && type === 'live') {
    return getAndAssertEnvironment('LIVE_STRIPE_KEY');
  }
  return getAndAssertEnvironment('TEST_STRIPE_KEY');
};

const generateSecret = ({ secretPrefix, branch, liveSecret }) => {
  const bareSecret = () => {
    if (isLive(branch)) {
      return liveSecret;
    }
    return branch;
  };

  return `${secretPrefix}:${bareSecret()}`;
};

const createApiGatewayResource = async ({ restApi, dir, catchAllResource }) => {
  if (catchAllResource) {
    return await ensureResource({
      restApi,
      path: '{proxy+}',
      parentPath: '/'
    });
  }

  await ensureResource({
    restApi,
    path: dir,
    parentPath: '/'
  });

  return await ensureResource({
    restApi,
    path: '{proxy+}',
    parentPath: `/${dir}`
  });
};

const ensureRouteForLambda = async ({ restApi, dir, lambdaArn, catchAllResource }) => {
  const resource = await createApiGatewayResource({ restApi, dir, catchAllResource });

  if (catchAllResource) {
    await ensureLambdaMethod({
      restApi,
      lambdaArn,
      resourceId: resource.parentId
    });
  }

  await ensureLambdaMethod({
    restApi,
    lambdaArn,
    resourceId: resource.id
  });
};

const getCertificateArn = ({ branch }) => isLive(branch) ?
  'arn:aws:acm:us-east-1:812374064424:certificate/8f1b6ff9-f215-4c9c-8a14-04a2aab84004' :
  'arn:aws:acm:us-east-1:812374064424:certificate/952d48cc-77bc-4736-b398-c5451e7dc970';

// TODO: doesn't remove resources left over when a dir is deleted until the branch is deleted
export default async ({ branch, dirs }) => {
  const serviceSecret = generateSecret({
    secretPrefix: 'service',
    branch,
    liveSecret: getAndAssertEnvironment('LIVE_SERVICE_TOKEN_SECRET')
  });
  const userSecret = generateSecret({
    secretPrefix: 'user',
    branch,
    liveSecret: getAndAssertEnvironment('LIVE_USER_TOKEN_SECRET')
  });

  const baseUrl = aliasToBaseUrl(branch);

  const restApi = await ensureRestApi({ name: generateName({ branch }) });

  for (const dir of dirs) {
    if (!lambdaConfig[dir]) {
      continue;
    }

    let db: DynamoDB.TableDescription = null;
    if (lambdaConfig[dir].database) {
      db = await ensureDatabase({ branch, dir });
    }

    const lambda = await ensureFunction({
      name: generateName({ branch, dir }),
      codeDirectory: dir,
      timeout: lambdaConfig[dir].timeout,
      codeFilter: lambdaConfig[dir].codeFilter,
      handler: lambdaConfig[dir].handler,
      dynamoAccess: lambdaConfig[dir].database,
      withApiGateway: lambdaConfig[dir].exposeOnGateway,
      live: isLive(branch),
      environment: {
        TABLE_NAME: db && db.TableName,
        BASE_URL: baseUrl,
        LAMBDA_BASE_URL: baseUrl,
        SERVICE_TOKEN_SECRET: serviceSecret,
        USER_TOKEN_SECRET: lambdaConfig[dir].withUserSecret && userSecret,
        LIVE_STRIPE_KEY: lambdaConfig[dir].withStripe && generateStripeKey({ branch, type: 'live' }),
        TEST_STRIPE_KEY: lambdaConfig[dir].withStripe && generateStripeKey({ branch, type: 'test' }),
        SLACK_CHANNEL_PREFIX: isLive(branch) ? '' : 'test-'
      }
    });

    if (lambdaConfig[dir].watchedTableNames) {
      for (const watchedTableName of lambdaConfig[dir].watchedTableNames) {
        const tableName = generateName({ branch, dir: watchedTableName });
        const table = await ensureStreamingDB(tableName);

        await ensureFunctionDynamoTrigger({
          lambdaFunc: lambda,
          table
        });
      }
    }

    if (lambdaConfig[dir].exposeOnGateway) {
      await ensureRouteForLambda({
        restApi,
        dir,
        lambdaArn: lambda.FunctionArn,
        catchAllResource: lambdaConfig[dir].catchAllResource
      });
    }
  }

  await ensureStagedDeployment({ restApi });

  const customDomain = await ensureDomainName({
    restApi,
    alias: branch,
    certificateArn: getCertificateArn({ branch })
  });

  await ensureAlias({
    alias: branch,
    value: customDomain.distributionDomainName
  });

  winston.info(`Deployed to ${baseUrl}`);
};
