import { ELBv2 } from 'aws-sdk';
import * as winston from 'winston';
import { describeAll } from '../describe';

export const ensureTargetGroup = async ({ name, vpc }) => {
  const elbv2 = new ELBv2({ apiVersion: '2015-12-01' });

  let targetGroup: ELBv2.TargetGroup;
  try {
    const response = await elbv2
      .createTargetGroup({
        Name: name,
        Protocol: 'HTTP',
        Port: 80,
        VpcId: vpc
      })
      .promise();

    targetGroup = response.TargetGroups[0];
  } catch (e) {
    if (e.code !== 'DuplicateTargetGroupName') {
      throw e;
    }

    // tslint:disable-next-line:no-console
    console.log(`targetGroup: '${name}' exists, describing...`, e);

    const response = await elbv2
      .describeTargetGroups({
        Names: [ name ]
      })
      .promise();

    targetGroup = response.TargetGroups[0];

    // tslint:disable-next-line:no-console
    console.log(`targetGroup: acquired`, targetGroup);
  }

  winston.debug('targetGroup: ensureTargetGroup', targetGroup);

  const modifyResponse = await elbv2
    .modifyTargetGroupAttributes({
      TargetGroupArn: targetGroup.TargetGroupArn,
      Attributes: [{
        Key: 'deregistration_delay.timeout_seconds',
        Value: '5'
      }]
    })
    .promise();

  winston.debug('targetGroup: modifyTargetGroupAttributes', modifyResponse);

  return targetGroup;
};

export const pruneTargetGroups = async ({ filter = (_targetGroup: ELBv2.TargetGroup) => false }) => {
  const elbv2 = new ELBv2({ apiVersion: '2015-12-01' });

  const describeResponse = await describeAll(
    // tslint:disable-next-line:variable-name
    (Marker) => elbv2.describeTargetGroups({ Marker }),
    (response) => response.TargetGroups
  );

  winston.debug('targetGroup: describeResponse', describeResponse);

  const targetGroupsToPrune = describeResponse.filter(filter);

  winston.debug('targetGroup: targetGroupsToPrune', targetGroupsToPrune);

  const promises = targetGroupsToPrune.map(targetGroup =>
    elbv2.deleteTargetGroup({ TargetGroupArn: targetGroup.TargetGroupArn })
      .promise()
  );

  await Promise.all(promises);
};
