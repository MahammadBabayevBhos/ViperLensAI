const { spawn } = require('child_process');
const path = require('path');

const PYTHON_EXECUTABLE = process.env.PYTHON_EXECUTABLE || 'python';
const ANALYZER_SCRIPT_PATH = path.resolve(__dirname, '../../scripts/analyze_malware.py');

const runPythonAnalysis = (filePath) => {
  return new Promise((resolve, reject) => {
    const args = [ANALYZER_SCRIPT_PATH, filePath];
    const pythonProcess = spawn(PYTHON_EXECUTABLE, args);

    let stdOut = '';
    let stdErr = '';

    pythonProcess.stdout.on('data', (chunk) => {
      stdOut += chunk.toString();
    });

    pythonProcess.stderr.on('data', (chunk) => {
      stdErr += chunk.toString();
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(
          new Error(`Python analysis failed with code ${code}. Details: ${stdErr || 'No details provided.'}`)
        );
      }

      try {
        const parsed = JSON.parse(stdOut || '{}');
        if (parsed.status === 'error') {
          return reject(new Error(parsed.message || 'Analyzer returned an error status.'));
        }
        resolve(parsed);
      } catch (_error) {
        resolve({
          status: 'completed',
          rawOutput: stdOut.trim() || 'No output received from analyzer.'
        });
      }
    });
  });
};

module.exports = {
  runPythonAnalysis
};
