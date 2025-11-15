#!/usr/bin/env node
/**
 * Auto-fix missing await statements and async function declarations
 */

import fs from 'fs';
import path from 'path';

const asyncMethods = [
  'listConversations',
  'getAllConversations',
  'getConversationById',
  'getConversationByPhoneAndChannel',
  'createConversation',
  'updateConversationMeta',
  'appendMessage',
  'acceptConversation',
  'assignConversation',
  'archiveConversation',
  'unarchiveConversation',
  'deleteConversation',
  'getMessages',
  'deleteMessage',
  'addAdvisorToAttendedBy',
  'updateMessage',
  'markAsRead',
  'markConversationRead',
  'releaseConversation',
  'listMessages',
  'getAttachment',
  'linkAttachmentToMessage',
  'updateMessageStatus'
];

let filesFixed = 0;
let awaitsFix = 0;
let asyncFix = 0;

function fixFile(filePath: string): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let modified = false;

  const lines = content.split('\n');
  const fixedLines: string[] = [];
  const linesNeedingAsync: number[] = [];

  // First pass: Add missing await statements and track which lines need it
  lines.forEach((line, index) => {
    let fixedLine = line;

    asyncMethods.forEach(method => {
      const regex = new RegExp(`crmDb\\.${method}\\s*\\(`, 'g');

      // Check if line has the pattern and doesn't have await
      if (regex.test(line) && !line.includes('await') && !line.trim().startsWith('//')) {
        // Check if it's an assignment
        const assignmentRegex = new RegExp(`(\\s*)(const|let|var)?\\s*([\\w]+)\\s*=\\s*crmDb\\.${method}`, 'g');
        if (assignmentRegex.test(line)) {
          fixedLine = line.replace(
            new RegExp(`(\\s*)(const|let|var)?\\s*([\\w]+)\\s*=\\s*crmDb\\.${method}`, 'g'),
            `$1$2 $3 = await crmDb.${method}`
          );
        } else {
          // Standalone call like: crmDb.markAsRead(...)
          fixedLine = line.replace(
            new RegExp(`(\\s*)crmDb\\.${method}`, 'g'),
            `$1await crmDb.${method}`
          );
        }
        modified = true;
        awaitsFix++;
        linesNeedingAsync.push(index);
        console.log(`  ✅ Line ${index + 1}: Added await for ${method}()`);
      }
    });

    fixedLines.push(fixedLine);
  });

  // Second pass: Make parent functions async
  if (linesNeedingAsync.length > 0) {
    linesNeedingAsync.forEach(lineIndex => {
      // Search backwards for function declaration
      for (let i = lineIndex; i >= 0; i--) {
        const line = fixedLines[i];

        // Match various function declaration patterns
        const patterns = [
          /^(\s*)(router\.(get|post|put|patch|delete)\s*\([^,]+,\s*)\((\s*req,\s*res)/,  // Express route handler
          /^(\s*)(private|public|protected)?\s*(\w+)\s*\(/,  // Class method
          /^(\s*)(const|let|var)\s+(\w+)\s*=\s*\(/,  // Arrow function
          /^(\s*)function\s+(\w+)\s*\(/  // Regular function
        ];

        for (const pattern of patterns) {
          if (pattern.test(line) && !line.includes('async')) {
            // Route handler pattern
            if (line.includes('router.')) {
              fixedLines[i] = line.replace(
                /(router\.(get|post|put|patch|delete)\s*\([^,]+,\s*)(\(|\basync\s)/,
                '$1async ('
              );
              asyncFix++;
              console.log(`  🔧 Line ${i + 1}: Made route handler async`);
              break;
            }
            // Class method pattern
            else if (line.match(/^\s*(private|public|protected)?\s*\w+\s*\(/)) {
              fixedLines[i] = line.replace(
                /^(\s*)(private|public|protected)?\s*(\w+)\s*\(/,
                '$1$2 async $3('
              );
              asyncFix++;
              console.log(`  🔧 Line ${i + 1}: Made method async`);
              break;
            }
            // Arrow function or regular function
            else {
              fixedLines[i] = line.replace(/=\s*\(/, '= async (').replace(/function\s+/, 'async function ');
              asyncFix++;
              console.log(`  🔧 Line ${i + 1}: Made function async`);
              break;
            }
          }
        }
      }
    });
  }

  if (modified) {
    content = fixedLines.join('\n');
    fs.writeFileSync(filePath, content, 'utf-8');
    filesFixed++;
    return true;
  }

  return false;
}

function walkDir(dir: string) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !file.includes('node_modules')) {
      walkDir(filePath);
    } else if (
      file.endsWith('.ts') &&
      !file.endsWith('.d.ts') &&
      !filePath.includes('db-postgres.ts') &&
      !filePath.includes('db.ts')
    ) {
      const relativePath = filePath.replace('/opt/flow-builder/', '');
      const fixed = fixFile(filePath);
      if (fixed) {
        console.log(`\n📝 Fixed: ${relativePath}`);
      }
    }
  });
}

console.log('🔧 Auto-fixing missing await statements...\n');

const serverDir = '/opt/flow-builder/server';
walkDir(serverDir);

console.log('\n' + '='.repeat(60));
if (awaitsFix > 0 || asyncFix > 0) {
  console.log(`✅ Fixed ${awaitsFix} missing await statements in ${filesFixed} files`);
  console.log(`✅ Made ${asyncFix} functions async`);
} else {
  console.log('✅ No issues found!');
}
console.log('='.repeat(60));

if (filesFixed > 0) {
  console.log('\n⚠️  Please review the changes and run tests!');
  process.exit(0);
} else {
  process.exit(0);
}
