/**
 * Remotion Configuration for VocalIA
 *
 * This file configures the Remotion CLI and Studio.
 * See: https://www.remotion.dev/docs/config
 */
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setConcurrency(4);

// Codec: h264 for MP4 output
Config.setCodec('h264');

// Quality settings (v4 API)
Config.setJpegQuality(90);
Config.setScale(1);

// Output directory
Config.setOutputLocation('out');
