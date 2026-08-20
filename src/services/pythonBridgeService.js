const { spawn } = require('child_process');
const path = require('path');

const getPythonCommand = () => {
  if (process.env.PYTHON_EXECUTABLE) {
    return process.env.PYTHON_EXECUTABLE;
  }
  return process.platform === 'win32' ? 'python' : 'python3';
};

const ANALYZER_SCRIPT_PATH = path.resolve(__dirname, '../../scripts/analyze_malware.py');

const executeProcess = (executable, filePath) => {
  return new Promise((resolve, reject) => {
    const args = [ANALYZER_SCRIPT_PATH, filePath];
    const pythonProcess = spawn(executable, args);

    let stdOut = '';
    let stdErr = '';

    pythonProcess.stdout.on('data', (chunk) => {
      stdOut += chunk.toString();
    });

    pythonProcess.stderr.on('data', (chunk) => {
      stdErr += chunk.toString();
    });

    pythonProcess.on('error', (error) => {
      reject(error);
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

const runPythonAnalysis = async (filePath) => {
  const primaryCmd = getPythonCommand();
  try {
    return await executeProcess(primaryCmd, filePath);
  } catch (err) {
    // If primary executable failed to spawn (ENOENT), try alternative binary
    if (err.code === 'ENOENT') {
      const fallbackCmd = primaryCmd === 'python' ? 'python3' : 'python';
      try {
        return await executeProcess(fallbackCmd, filePath);
      } catch (fallbackErr) {
        throw new Error(`Failed to start Python analyzer using '${primaryCmd}' and '${fallbackCmd}': ${fallbackErr.message}`);
      }
    }
    throw err;
  }
};

module.exports = {
  runPythonAnalysis
};

