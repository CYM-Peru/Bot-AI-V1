#!/usr/bin/env node
/**
 * Pre-deployment checker
 * Detects common errors before deployment
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

const results: CheckResult[] = [];

// Color codes
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

function log(message: string, color: string = RESET) {
  console.log(`${color}${message}${RESET}`);
}

function checkTypeScript(): CheckResult {
  const result: CheckResult = {
    name: 'TypeScript Compilation',
    passed: true,
    errors: [],
    warnings: []
  };

  try {
    log('\n🔍 Checking TypeScript compilation...', BLUE);
    execSync('npx tsc --noEmit 2>&1', {
      cwd: '/opt/flow-builder',
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    log('✅ TypeScript compilation passed', GREEN);
  } catch (error: any) {
    const output = error.stdout || error.message;

    // Parse errors
    const errorLines = output.split('\n').filter((line: string) =>
      line.includes('error TS')
    );

    if (errorLines.length > 0) {
      result.passed = false;
      result.errors = errorLines.slice(0, 10); // First 10 errors
      log(`❌ Found ${errorLines.length} TypeScript errors`, RED);
    }
  }

  return result;
}

function checkMissingAwaits(): CheckResult {
  const result: CheckResult = {
    name: 'Missing await on async calls',
    passed: true,
    errors: [],
    warnings: []
  };

  log('\n🔍 Checking for missing await statements...', BLUE);

  const serverDir = '/opt/flow-builder/server';
  const asyncMethods = [
    'listConversations',
    'getAllConversations',
    'getConversationById',
    'getConversationByPhoneAndChannel',
    'createConversation',
    'updateConversationMeta',
    'appendMessage',
    'acceptConversation',
    'getMessages'
  ];

  function scanFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      asyncMethods.forEach(method => {
        // Check if method is called without await
        const regex = new RegExp(`crmDb\\.${method}\\s*\\(`);
        if (regex.test(line)) {
          // Skip if line has await, is a definition, or is commented
          if (
            !line.includes('await') &&
            !line.includes('async') &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('*') &&
            !filePath.includes('db-postgres.ts') &&
            !filePath.includes('db.ts')
          ) {
            const error = `${filePath}:${index + 1} - Missing await for ${method}()`;
            result.errors.push(error);
            result.passed = false;
          }
        }
      });
    });
  }

  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.includes('node_modules')) {
        walkDir(filePath);
      } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
        scanFile(filePath);
      }
    });
  }

  try {
    walkDir(serverDir);

    if (result.passed) {
      log('✅ All async calls have await', GREEN);
    } else {
      log(`❌ Found ${result.errors.length} missing await statements`, RED);
      result.errors.slice(0, 5).forEach(err => log(`  ${err}`, RED));
    }
  } catch (error: any) {
    result.warnings.push(`Error scanning files: ${error.message}`);
  }

  return result;
}

function checkUndefinedAccess(): CheckResult {
  const result: CheckResult = {
    name: 'Undefined property access',
    passed: true,
    errors: [],
    warnings: []
  };

  log('\n🔍 Checking for unsafe property access...', BLUE);

  const serverDir = '/opt/flow-builder/server';

  function scanFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Check for common patterns like settings.bounceConfig without null checks
      const unsafePatterns = [
        /settings\.bounceConfig\./,
        /\.filter\(/,  // calling filter on potentially undefined
      ];

      unsafePatterns.forEach(pattern => {
        if (pattern.test(line) && !line.includes('?') && !line.trim().startsWith('//')) {
          // This is a warning, not an error
          const warning = `${filePath}:${index + 1} - Potentially unsafe access: ${line.trim()}`;
          result.warnings.push(warning);
        }
      });
    });
  }

  function walkDir(dir: string) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.includes('node_modules')) {
        walkDir(filePath);
      } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
        scanFile(filePath);
      }
    });
  }

  try {
    walkDir(serverDir);

    if (result.warnings.length === 0) {
      log('✅ No unsafe property access detected', GREEN);
    } else {
      log(`⚠️  Found ${result.warnings.length} potential issues`, YELLOW);
    }
  } catch (error: any) {
    result.warnings.push(`Error scanning files: ${error.message}`);
  }

  return result;
}

// Run all checks
async function runChecks() {
  log('🚀 Running pre-deployment checks...', BLUE);

  results.push(checkTypeScript());
  results.push(checkMissingAwaits());
  results.push(checkUndefinedAccess());

  // Summary
  log('\n' + '='.repeat(60), BLUE);
  log('📊 SUMMARY', BLUE);
  log('='.repeat(60), BLUE);

  let totalErrors = 0;
  let totalWarnings = 0;

  results.forEach(result => {
    const status = result.passed ? `${GREEN}✅ PASS${RESET}` : `${RED}❌ FAIL${RESET}`;
    log(`\n${status} ${result.name}`);

    if (result.errors.length > 0) {
      log(`  Errors: ${result.errors.length}`, RED);
      totalErrors += result.errors.length;
    }

    if (result.warnings.length > 0) {
      log(`  Warnings: ${result.warnings.length}`, YELLOW);
      totalWarnings += result.warnings.length;
    }
  });

  log('\n' + '='.repeat(60), BLUE);
  log(`Total Errors: ${totalErrors}`, totalErrors > 0 ? RED : GREEN);
  log(`Total Warnings: ${totalWarnings}`, totalWarnings > 0 ? YELLOW : GREEN);
  log('='.repeat(60), BLUE);

  if (totalErrors > 0) {
    log('\n❌ Pre-deployment checks FAILED', RED);
    process.exit(1);
  } else {
    log('\n✅ All checks passed!', GREEN);
    process.exit(0);
  }
}

runChecks();
