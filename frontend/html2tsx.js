import fs from 'fs';

function convert(filepath, componentName) {
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Extract main layout inside body
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  }

  // Remove trailing scripts if any
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');

  // Convert class strictly
  content = content.replace(/class=/g, 'className=');
  // Convert for to htmlFor
  content = content.replace(/for=/g, 'htmlFor=');
  
  // Self close img, input, br, hr
  // First make sure not to break already closed ones
  content = content.replace(/<(img|input|br|hr)([^>]*?)(?<!\/)>/ig, '<$1$2 />');
  
  // Replace HTML comments with JSX comments
  content = content.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');

  const template = `import React from 'react';
import { Link } from 'react-router-dom';

export default function ${componentName}() {
  return (
    <div className="bg-surface text-on-surface min-h-screen">
      ${content}
    </div>
  );
}`;

  fs.writeFileSync(`src/pages/${componentName}.tsx`, template);
  console.log(`Created ${componentName}.tsx`);
}

convert('src/TeacherDashboard.html', 'TeacherDashboard');
convert('src/StudentDashboard.html', 'StudentDashboard');
