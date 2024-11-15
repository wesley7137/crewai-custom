import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Typography,
  Grid,
  Box,
  Select,
  MenuItem,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  FormControl,
  InputLabel
} from "@mui/material";
import { ExpandMore, Settings } from "@mui/icons-material";
import OutputDisplay from "./OutputDisplay";
import { API_BASE_URL } from "../config";
import ClientSelector from "./ClientSelector";
import { useClient } from "./ClientContext";
import "./AgentsPage.css";
import { io } from "socket.io-client";

const AgentsPage = () => {
  const { clients, selectedClient, setSelectedClient } = useClient();
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [contentInput, setContentInput] = useState("");
  const [outputs, setOutputs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [settings, setSettings] = useState({
    parameter1: "",
    parameter2: "",
    option1: false,
    option2: false,
    option3: false
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [crewType, setCrewType] = useState("autoblogging");
  const [crewSettings, setCrewSettings] = useState({
    autoblogging: {
      topic: "",
      target_audience: "",
      headline: "",
      subheading: "",
      key_points: [],
      tone_of_voice: "",
      industry_focus: "",
      target_publications: "",
      company_boilerplate: "",
      spokesperson_name: "",
      spokesperson_title: "",
      contact_information: "",
      release_urgency: "normal",
      distribution_channels: [],
      related_keywords: "",
      target_word_count: "500"
    },
    campaign_planning: {
      focus_topic: "",
      target_audience: "",
      campaign_duration: "",
      key_message: "",
      secondary_messages: []
    },
    client_reporting: {
      client_name: "",
      report_frequency: "daily"
    },
    networking: {
      client_name: "",
      industry: "",
      location: ""
    },
    pr_research: {
      client_name: "",
      industry: ""
    }
  });
  const [clientData, setClientData] = useState(null);
  const [clientError, setClientError] = useState(null);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [logContent, setLogContent] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const [taskId, setTaskId] = useState(null);

  // File listing
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/files`);
      const data = await response.json();
      setFiles(data.files);
      setError(null);
    } catch (err) {
      setError("Failed to load files");
      console.error("Error fetching files:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);

      // Upload the file
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(`${API_BASE_URL}/upload`, {
          method: "POST",
          body: formData
        });

        if (response.ok) {
          fetchFiles(); // Refresh file list after upload
        } else {
          setError("Failed to upload file");
        }
      } catch (err) {
        console.error("Error uploading file:", err);
        setError("Failed to upload file");
      }
    }
  };

  const handleCrewSettingChange = (crew, field, value) => {
    setCrewSettings((prev) => ({
      ...prev,
      [crew]: {
        ...prev[crew],
        [field]: value
      }
    }));
  };

  useEffect(() => {
    let pollInterval;

    if (isPolling && taskId) {
      pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/agent-output`);
          const data = await response.json();
          if (data.success && data.data) {
            // Look for entries matching our taskId
            const relevantUpdates = data.data.filter(
              (update) =>
                update.task_id === taskId ||
                (update.message && update.message.task_id === taskId)
            );

            if (relevantUpdates.length > 0) {
              setLogContent((prev) => {
                const newContent = relevantUpdates
                  .map((update) => JSON.stringify(update, null, 2))
                  .join("\n");
                return prev ? `${prev}\n${newContent}` : newContent;
              });

              // Check for completion or error
              const lastUpdate = relevantUpdates[relevantUpdates.length - 1];
              if (
                lastUpdate.type === "success" ||
                lastUpdate.type === "error"
              ) {
                setIsPolling(false);
              }
            }
          }
        } catch (error) {
          console.error("Error fetching agent output:", error);
        }
      }, 5000);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isPolling, taskId]);

  const handleExecuteCrew = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/execute-crew`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          crew: crewType,
          data: {
            content: contentInput,
            client_id: selectedClient?.id,
            settings: crewSettings[crewType],
            special_instructions: specialInstructions
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to execute crew");
      }

      setTaskId(data.task_id);
      setIsPolling(true);
    } catch (err) {
      console.error("Error executing crew:", err);
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const renderCrewForm = () => {
    switch (crewType) {
      case "autoblogging":
        return (
          <Box className="form-container">
            <TextField
              fullWidth
              label="Tone of Voice"
              select
              value={crewSettings.autoblogging.tone_of_voice}
              onChange={(e) =>
                handleCrewSettingChange(
                  "autoblogging",
                  "tone_of_voice",
                  e.target.value
                )
              }
            >
              <MenuItem value="formal">Formal</MenuItem>
              <MenuItem value="professional">Professional</MenuItem>
              <MenuItem value="conversational">Conversational</MenuItem>
              <MenuItem value="technical">Technical</MenuItem>
            </TextField>

            <TextField
              fullWidth
              label="Target Publications"
              value={crewSettings.autoblogging.target_publications}
              onChange={(e) =>
                handleCrewSettingChange(
                  "autoblogging",
                  "target_publications",
                  e.target.value
                )
              }
            />

            <TextField
              fullWidth
              label="Target Word Count"
              type="number"
              value={crewSettings.autoblogging.target_word_count}
              onChange={(e) =>
                handleCrewSettingChange(
                  "autoblogging",
                  "target_word_count",
                  e.target.value
                )
              }
            />

            <Select
              fullWidth
              value={crewSettings.autoblogging.release_urgency}
              onChange={(e) =>
                handleCrewSettingChange(
                  "autoblogging",
                  "release_urgency",
                  e.target.value
                )
              }
              label="Release Urgency"
            >
              <MenuItem value="immediate">Immediate Release</MenuItem>
              <MenuItem value="normal">Normal</MenuItem>
              <MenuItem value="embargo">Embargo</MenuItem>
            </Select>
          </Box>
        );

      case "campaign_planning":
        return (
          <Box className="form-container">
            <TextField
              fullWidth
              label="Focus Topic"
              value={crewSettings.campaign_planning.focus_topic}
              onChange={(e) =>
                handleCrewSettingChange(
                  "campaign_planning",
                  "focus_topic",
                  e.target.value
                )
              }
            />
            <TextField
              fullWidth
              label="Target Audience"
              value={crewSettings.campaign_planning.target_audience}
              onChange={(e) =>
                handleCrewSettingChange(
                  "campaign_planning",
                  "target_audience",
                  e.target.value
                )
              }
            />
            <TextField
              fullWidth
              label="Campaign Duration"
              value={crewSettings.campaign_planning.campaign_duration}
              onChange={(e) =>
                handleCrewSettingChange(
                  "campaign_planning",
                  "campaign_duration",
                  e.target.value
                )
              }
            />
            <TextField
              fullWidth
              label="Key Message"
              multiline
              rows={2}
              value={crewSettings.campaign_planning.key_message}
              onChange={(e) =>
                handleCrewSettingChange(
                  "campaign_planning",
                  "key_message",
                  e.target.value
                )
              }
            />
          </Box>
        );

      case "client_reporting":
        return (
          <Box className="form-container">
            <Select
              fullWidth
              value={crewSettings.client_reporting.report_frequency}
              onChange={(e) =>
                handleCrewSettingChange(
                  "client_reporting",
                  "report_frequency",
                  e.target.value
                )
              }
              label="Report Frequency"
            >
              <MenuItem value="daily">Daily</MenuItem>
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
              <MenuItem value="quarterly">Quarterly</MenuItem>
            </Select>
          </Box>
        );

      case "networking":
        return (
          <Box className="form-container">
            <TextField
              fullWidth
              label="Industry"
              value={crewSettings.networking.industry}
              onChange={(e) =>
                handleCrewSettingChange(
                  "networking",
                  "industry",
                  e.target.value
                )
              }
            />
            <TextField
              fullWidth
              label="Location"
              value={crewSettings.networking.location}
              onChange={(e) =>
                handleCrewSettingChange(
                  "networking",
                  "location",
                  e.target.value
                )
              }
            />
          </Box>
        );

      case "pr_research":
        return (
          <Box className="form-container">
            <TextField
              fullWidth
              label="Industry"
              value={crewSettings.pr_research.industry}
              onChange={(e) =>
                handleCrewSettingChange(
                  "pr_research",
                  "industry",
                  e.target.value
                )
              }
            />
          </Box>
        );

      default:
        return null;
    }
  };

  const handleClientSelect = (clientId) => {
    const client = clients.find((c) => c.id === clientId);
    setSelectedClient(client);

    // Update crew settings based on selected client
    if (client) {
      setCrewSettings((prev) => ({
        ...prev,
        autoblogging: {
          ...prev.autoblogging,
          industry_focus: client.industry || "",
          company_boilerplate: client.boilerplate || "",
          contact_information: client.contact_info || "",
          target_audience: client.target_audience || "",
          spokesperson_name: client.spokesperson_name || "",
          spokesperson_title: client.spokesperson_title || ""
        }
      }));
    }
  };

  useEffect(() => {
    if (selectedClient) {
      handleClientSelect(selectedClient.id);
    }
  }, [selectedClient]);

  const handleContentChange = (e) => {
    setContentInput(e.target.value);
  };

  return (
    <Box className="agents-page-container">
      <Typography variant="h5" className="page-title">
        Agent Control Panel
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card className="input-card">
            <CardContent>
              <Grid container spacing={3}>
                {/* Client Selection */}
                <Grid item xs={12}>
                  <ClientSelector />
                </Grid>

                {/* Agent Type Selection */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Process Type</InputLabel>
                    <Select
                      value={crewType}
                      onChange={(e) => setCrewType(e.target.value)}
                      label="Process Type"
                    >
                      <MenuItem value="autoblogging">
                        Autoblogging Content Creation
                      </MenuItem>
                      <MenuItem value="campaign_planning">
                        Campaign Planning
                      </MenuItem>
                      <MenuItem value="client_reporting">
                        Client Reporting
                      </MenuItem>
                      <MenuItem value="networking">
                        Industry Networking
                      </MenuItem>
                      <MenuItem value="pr_research">PR Research</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {/* Content Input */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    label="Content Input"
                    placeholder="Paste your content here..."
                    value={contentInput}
                    onChange={handleContentChange}
                    disabled={isProcessing}
                  />
                </Grid>

                {/* Special Instructions */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Special Instructions (Optional)"
                    placeholder="Add any specific requirements or instructions for content generation..."
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    helperText="E.g., tone preferences, specific formatting requirements, or additional context"
                    className="special-instructions-field"
                  />
                </Grid>

                {/* Execute Button */}
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={handleExecuteCrew}
                    disabled={isProcessing || !selectedClient || !contentInput}
                  >
                    {isProcessing ? "Processing..." : "Process Content"}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title={
                <Box className="settings-header">
                  <Settings fontSize="small" />
                  <Typography>Advanced Options</Typography>
                </Box>
              }
            />
            <CardContent>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Box className="form-container">{renderCrewForm()}</Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card className="output-card">
            <CardContent>
              <OutputDisplay />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Show error if any */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default AgentsPage;
