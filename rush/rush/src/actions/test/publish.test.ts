import { expect } from 'chai';
import {
  IChangeInfo,
  ChangeType,
  RushConfig,
  RushConfigProject
} from '@microsoft/rush-lib';
import * as path from 'path';
import {
  IChangeInfoHash,
  findChangeRequests,
  isRangeDependency,
  sortChangeRequests,
  updatePackages,
  findMissingChangedPackages
} from '../publish';

/* tslint:disable:no-string-literal */

describe('findChangeRequests', () => {

  it('returns no changes in an empty change folder', () => {
    const allPackages: Map<string, RushConfigProject> =
      RushConfig.loadFromConfigFile(path.resolve(__dirname, 'packages', 'rush.json')).projectsByName;
    const allChanges: IChangeInfoHash = findChangeRequests(allPackages, path.join(__dirname, 'noChange'));

    expect(Object.keys(allChanges).length).to.equal(0);
  });

  it('returns 1 change when changing a leaf package', () => {
    const allPackages: Map<string, RushConfigProject> =
      RushConfig.loadFromConfigFile(path.resolve(__dirname, 'packages', 'rush.json')).projectsByName;
    const allChanges: IChangeInfoHash = findChangeRequests(allPackages, path.join(__dirname, 'leafChange'));

    expect(Object.keys(allChanges).length).to.equal(1);
    expect(allChanges).has.property('d');
    expect(allChanges['d'].changeType).equals(ChangeType.patch, 'd was not patched');
  });

  it('returns 2 changes when patching a root package', () => {
    const allPackages: Map<string, RushConfigProject> =
      RushConfig.loadFromConfigFile(path.resolve(__dirname, 'packages', 'rush.json')).projectsByName;
    const allChanges: IChangeInfoHash = findChangeRequests(allPackages, path.join(__dirname, 'rootPatchChange'));

    expect(Object.keys(allChanges).length).to.equal(2);

    expect(allChanges).has.property('a');
    expect(allChanges).has.property('b');

    expect(allChanges['a'].changeType).equals(ChangeType.patch, 'a was not a patch');
    expect(allChanges['b'].changeType).equals(ChangeType.dependency, 'b was not a dependency change');

    expect(allChanges['a'].newVersion).equals('1.0.1', 'a was not patched');
    expect(allChanges['b'].newVersion).equals('1.0.0', 'b was not left unchanged');
  });

  it('returns 3 changes when major bumping a root package', () => {
    const allPackages: Map<string, RushConfigProject> =
      RushConfig.loadFromConfigFile(path.resolve(__dirname, 'packages', 'rush.json')).projectsByName;
    const allChanges: IChangeInfoHash = findChangeRequests(allPackages, path.join(__dirname, 'rootMajorChange'));

    expect(Object.keys(allChanges).length).to.equal(3);

    expect(allChanges).has.property('a');
    expect(allChanges).has.property('b');
    expect(allChanges).has.property('c');

    expect(allChanges['a'].changeType).equals(ChangeType.major, 'a was not a major');
    expect(allChanges['b'].changeType).equals(ChangeType.patch, 'b was not a patch');
    expect(allChanges['c'].changeType).equals(ChangeType.dependency, 'c was not a dependency change');

    expect(allChanges['a'].newVersion).equals('2.0.0', 'a was not a major change');
    expect(allChanges['b'].newVersion).equals('1.0.1', 'b was not patched');
    expect(allChanges['c'].newVersion).equals('1.0.0', 'c was not left unchanged');
  });

  it('can resolve multiple changes requests on the same package', () => {
    const allPackages: Map<string, RushConfigProject> =
      RushConfig.loadFromConfigFile(path.resolve(__dirname, 'packages', 'rush.json')).projectsByName;
    const allChanges: IChangeInfoHash = findChangeRequests(allPackages, path.join(__dirname, 'multipleChanges'));

    expect(Object.keys(allChanges).length).to.equal(3);
    expect(allChanges).has.property('a');
    expect(allChanges).has.property('b');
    expect(allChanges).has.property('c');
    expect(allChanges['a'].changeType).equals(ChangeType.major, 'a was not a major');
    expect(allChanges['b'].changeType).equals(ChangeType.patch, 'b was not a patch');
    expect(allChanges['c'].changeType).equals(ChangeType.dependency, 'c was not a dependency change');
    expect(allChanges['a'].newVersion).equals('2.0.0', 'a was not a major change');
    expect(allChanges['b'].newVersion).equals('1.0.1', 'b was not patched');
    expect(allChanges['c'].newVersion).equals('1.0.0', 'b was not left unchanged');
  });

  it('can update an explicit dependency', () => {
    const allPackages: Map<string, RushConfigProject> =
      RushConfig.loadFromConfigFile(path.resolve(__dirname, 'packages', 'rush.json')).projectsByName;
    const allChanges: IChangeInfoHash = findChangeRequests(allPackages, path.join(__dirname, 'explicitVersionChange'));

    expect(Object.keys(allChanges).length).to.equal(2);
    expect(allChanges).has.property('c');
    expect(allChanges).has.property('d');
    expect(allChanges['c'].changeType).equals(ChangeType.patch, 'c was not a patch');
    expect(allChanges['d'].changeType).equals(ChangeType.patch, 'd was not a patch');
  });

});

describe('sortChangeRequests', () => {
  it('can return a sorted array of the change requests to be published in the correct order', () => {
    const allPackages: Map<string, RushConfigProject> =
      RushConfig.loadFromConfigFile(path.resolve(__dirname, 'packages', 'rush.json')).projectsByName;
    const allChanges: IChangeInfoHash = findChangeRequests(allPackages, path.join(__dirname, 'multipleChanges'));
    const orderedChanges: IChangeInfo[] = sortChangeRequests(allChanges);

    expect(orderedChanges.length).equals(3, 'there was not 3 changes');
    expect(orderedChanges[0].packageName).equals('a', 'a was not at index 0');
    expect(orderedChanges[1].packageName).equals('b', 'b was not at index 1');
    expect(orderedChanges[2].packageName).equals('c', 'c was not at index 2');
  });
});

describe('updatePackages', () => {
  it('can apply changes to the package.json files in the dictionary', () => {
    const allPackages: Map<string, RushConfigProject> =
      RushConfig.loadFromConfigFile(path.resolve(__dirname, 'packages', 'rush.json')).projectsByName;
    const allChanges: IChangeInfoHash = findChangeRequests(allPackages, path.join(__dirname, 'multipleChanges'));

    updatePackages(allChanges, allPackages, false);

    expect(allPackages.get('a').packageJson.version).equals('2.0.0', 'a was not 2.0.0');
    expect(allPackages.get('b').packageJson.version).equals('1.0.1', 'b was not patched');
    expect(allPackages.get('b').packageJson.dependencies['a']).equals(
      '>=2.0.0 <3.0.0',
      'the "a" dependency in "b" was not updated');
    expect(allPackages.get('c').packageJson.version).equals('1.0.0', 'c version was changed');
    expect(allPackages.get('c').packageJson.dependencies['b']).equals(
      '>=1.0.1 <2.0.0',
      'the "b" dependency in "c" was not updated');
  });

  it('can update explicit version dependency', () => {
    const allPackages: Map<string, RushConfigProject> =
      RushConfig.loadFromConfigFile(path.resolve(__dirname, 'packages', 'rush.json')).projectsByName;
    const allChanges: IChangeInfoHash = findChangeRequests(allPackages, path.join(__dirname, 'explicitVersionChange'));

    updatePackages(allChanges, allPackages, false);

    expect(allPackages.get('c').packageJson.version).equals('1.0.1', 'c was not patched');
    expect(allPackages.get('d').packageJson.version).equals('1.0.1', 'd was not patched');
    expect(allPackages.get('d').packageJson.dependencies['c']).equals(
      '1.0.1',
      'the "c" dependency in "d" was not updated');
  });
});

describe('isRangeDependency', () => {
  it('can test ranges', () => {
    expect(isRangeDependency('>=1.0.0 <2.0.0')).is.true;
    expect(isRangeDependency('1.0.0')).is.false;
    expect(isRangeDependency('^1.0.0')).is.false;
    expect(isRangeDependency('~1.0.0')).is.false;
  });
});

describe('findMissingChangedPackages', () => {
  it('finds the missing package.', () => {
    const changeFile: string = path.join(__dirname, 'verifyChanges', 'changes.json');
    const changedPackages: string[] = ['a', 'b', 'c'];
    expect(findMissingChangedPackages(changeFile, changedPackages)).to.contain('c',
      'c should be missing');
    expect(findMissingChangedPackages(changeFile, changedPackages)).to.have.lengthOf(1,
      'only c is missing');
  });

  it('finds nothing when no missing packages', () => {
    const changeFile: string = path.join(__dirname, 'verifyChanges', 'changes.json');
    const changedPackages: string[] = ['a'];
    expect(findMissingChangedPackages(changeFile, changedPackages)).to.have.lengthOf(0,
      'nothing is missing');
  });
});