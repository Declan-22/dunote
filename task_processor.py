import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import ollama
from ollama import Client
import re
from jsoncomment import JsonComment
import urllib.parse


from task_model import Task, Silo, TaskStatus, TaskPriority

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
MODEL_NAME = "deepseek-r1:1.5b"  # Defined in Modelfile
CONTEXT_WINDOW = 4096
MAX_TOKENS = 1024

class TaskProcessor:
    def __init__(self):
        self.client = Client(host='http://localhost:11434')
        self.model = "deepseek-r1:1.5b"  # Without :latest suffix
        
        try:
            models = self.client.list()
            if not any(m['model'] == "deepseek-r1:1.5b" for m in models['models']):
                raise ValueError("deepseek-r1:1.5b model not found in Ollama")
            
            logger.info("Connected to Ollama with deepseek-r1:1.5b model")
            
        except Exception as e:
            logger.error(f"Ollama connection failed: {str(e)}")
            raise RuntimeError("AI service unavailable") from e
    def process(self, tasks):
        prompt = self.create_prompt(tasks)
        result = self.client.generate(model="TaskModel", prompt=prompt)
        return result

    def _call_model(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None,
        temperature: float = 0.3
    ) -> str:
        """Call the LLM model with the given prompt."""
        try:
            # Add explicit instruction to avoid <think> pattern
            if system_prompt:
                enhanced_system = system_prompt + "\nDO NOT include any thinking, reasoning process, or explanations unless asked."
            else:
                enhanced_system = "Respond concisely and directly. DO NOT include any thinking, reasoning process, or explanations unless asked."
            
            response = ollama.generate(
                model=self.model,
                prompt=prompt,
                system=enhanced_system,
                options={
                    "temperature": temperature,
                    "top_p": 0.9,
                    "top_k": 40,
                    "num_predict": MAX_TOKENS,
                    # Add any other options like stop tokens if supported:
                    # "stop": ["<think>"]
                }
            )
            
            # Clean the response to remove thinking patterns
            result = response['response']
            result = re.sub(r'<think>.*?</think>', '', result, flags=re.DOTALL)
            result = re.sub(r'<think>.*', '', result, flags=re.DOTALL)
            
            return result
        except Exception as e:
            logger.error(f"Error calling model: {e}")
            return ""
    def create_prompt(self, tasks):
        # Build your prompt from tasks
        return "\n".join(tasks)

    def parse_task(self, task_description: str) -> Task:
        """Parse a task description into a structured Task object."""
        system_prompt = """
        Extract the following information from the task description:
        - Title (required)
        - Description (optional)
        - Priority (low, medium, high, urgent)
        - Due date (if any)
        - Estimated time to complete (if any)
        - Tags (if any)
        
        Format your response as a JSON object with these fields.
        """
        
        prompt = f"Parse this task: {task_description}"
        response = self._call_model(prompt, system_prompt)
        
        # Try to extract JSON from the response
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                task_data = json.loads(json_str)
            else:
                pass  # Placeholder for the else block
                # Fallback if no JSON is found
                logger.warning("No JSON found in response, using minimal task data")
                task_data = {"title": task_description}
        except Exception as e:
            logger.error(f"Error parsing model response as JSON: {e}")
            task_data = {"title": task_description}
        
        # Process the data
        title = task_data.get("title", task_description[:50])
        description = task_data.get("description", "")
        
        # Parse priority
        priority_str = task_data.get("priority", "medium").lower()
        if priority_str in [p.value for p in TaskPriority]:
            priority = TaskPriority(priority_str)
        else:
            priority = TaskPriority.MEDIUM
        
        # Parse due date
        due_date = None
        if "due_date" in task_data and task_data["due_date"]:
            try:
                due_date = datetime.fromisoformat(task_data["due_date"])
            except:
                try:
                    # Try to parse common date formats
                    date_formats = ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%B %d, %Y"]
                    for fmt in date_formats:
                        try:
                            due_date = datetime.strptime(task_data["due_date"], fmt)
                            break
                        except:
                            continue
                except:
                    pass
        
        # Parse estimated time
        estimated_time = None
        if "estimated_time" in task_data and task_data["estimated_time"]:
            # Try to extract hours from various formats
            time_str = str(task_data["estimated_time"])
            hours_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:hour|hr|h)', time_str, re.IGNORECASE)
            if hours_match:
                hours = float(hours_match.group(1))
                estimated_time = timedelta(hours=hours)
            else:
                minutes_match = re.search(r'(\d+)\s*(?:minute|min|m)', time_str, re.IGNORECASE)
                if minutes_match:
                    minutes = int(minutes_match.group(1))
                    estimated_time = timedelta(minutes=minutes)
        
        # Parse tags
        tags = []
        if "tags" in task_data and isinstance(task_data["tags"], list):
            tags = task_data["tags"]
        elif "tags" in task_data and isinstance(task_data["tags"], str):
            # If tags are provided as a comma-separated string
            tags = [tag.strip() for tag in task_data["tags"].split(",") if tag.strip()]
        
        # Create a new task
        # Note: silo_id will be set by the caller
        return Task(
            title=title,
            description=description,
            priority=priority,
            due_date=due_date,
            estimated_time=estimated_time,
            tags=tags,
            silo_id="",  # To be set by caller
            ai_generated=True
        )
    
    # task_processor.py
    def process_task_dump(self, tasks_input) -> Dict:
        """Process tasks with proper naming and child nodes"""
        # Normalize input to handle both strings and lists
        task_text = '\n'.join(tasks_input) if isinstance(tasks_input, list) else tasks_input
        
        # Parse tasks with enhanced bullet point detection
        tasks = self._robust_parse_tasks(task_text)
        
        if not tasks:
            return {
                "error": "Couldn't identify tasks. Use clear bullet points (-) with one task per line",
                "nodes": [],
                "dependencies": [],
                "critical_path": []
            }
        
        base_x = 100
        base_y = 100
        x_offset = 300
        y_offset = 150
        
        # Create nodes with proper hierarchy
        nodes = []
        edges = []  # Initialize edges array to store connections
        
        for idx, task in enumerate(tasks):
            # Generate meaningful title using AI
            title = self._generate_task_title(task)
            
            # Generate position
            position = {
                "x": base_x + (idx % 3) * x_offset,
                "y": base_y + (idx // 3) * y_offset
            }
            
            # Create task node
            task_id = f"task_{idx}"
            task_node = {
                "id": task_id,
                "type": "task",
                "position": position,
                "data": {  # Move title into data object
                    "title": title,
                    "label": title,
                    "original_text": task
                },
                "children": [],
                "metadata": {
                    "ai_generated": True,
                    "created_at": datetime.now().isoformat()
                }
            }
            nodes.append(task_node)
            
            # Generate research children with validation
            if self._requires_research(task):
                resources = self._generate_research_sources(task)
                for res_idx, resource in enumerate(resources):
                    resource_id = f"res_{idx}_{res_idx}"
                    task_node["children"].append(resource_id)
                    
                    # Validate URL format
                    if not re.match(r'^https?://', resource["url"]):
                        resource["url"] = "#invalid-url"
                    
                    # Create source node
# In task_processor.py
                    resource_node = {
                        "id": resource_id,
                        "type": "resource",
                        "position": {
                            "x": position["x"] + 150,
                            "y": position["y"] + (res_idx * 100)
                        },
                        "data": {  # Move all data into data property
                            "title": resource["title"][:100],
                            "url": resource["url"],
                            "summary": resource["summary"][:200],
                            "key_points": resource["key_points"][:3]
                        },
                        "metadata": {
                            "ai_generated": True,
                            "verified": False
                        }
                    }
                    nodes.append(resource_node)
                    
                    # Create connection from task to resource
                    edges.append({
                        "source": task_id,
                        "target": resource_id,
                        "type": "uses_resource"
                    })

        # Improved dependency analysis
        analysis = self._enhanced_analysis(tasks, nodes)
        
        # Add task dependencies as connections
        for dep in analysis.get("dependencies", []):
            if len(dep) == 2:
                edges.append({
                    "source": dep[0],
                    "target": dep[1],
                    "type": "dependency" if dep[1].startswith("task_") else "resource"
                })

            # Create parent-child connections
        for node in nodes:
            if node["type"] == "task" and node.get("children"):
                for child_id in node["children"]:
                    edges.append({
                        "source": node["id"],
                        "target": child_id,
                        "type": "resource"
                    })

        # Add task dependencies AFTER resource connections
        analysis = self._enhanced_analysis(tasks, nodes)
        for dep in analysis.get("dependencies", []):
            edges.append({
                "source": dep[0],
                "target": dep[1],
                "type": "dependency"
            })
        
        
        logger.debug("Final nodes structure:")
        for node in nodes:
            logger.debug(json.dumps(node, indent=2))
        
        logger.debug("Edges to create:")
        for edge in edges:
            logger.debug(f"{edge['source']} -> {edge['target']}")
        
        return {
            "nodes": nodes,
            "edges": edges,
            "critical_path": analysis["critical_path"],
            "warning": analysis.get("error")
        }
    
    def _robust_parse_tasks(self, text: str) -> List[str]:
        """Improved task parsing with multiple fallbacks"""
        # First try standard bullet point parsing
        tasks = re.findall(r'^-\s*(.+)$', text, flags=re.MULTILINE)
        
        # Fallback to any line starting with special character
        if not tasks:
            tasks = re.findall(r'^[•*]\s*(.+)$', text, flags=re.MULTILINE)
        
        # Final fallback: split on newlines
        if not tasks:
            tasks = [line.strip() for line in text.split('\n') if line.strip()]
        
        return tasks

    def _generate_task_title(self, task_text: str) -> str:
        """Generate meaningful titles with validation"""
        prompt = f"""Generate a concise, descriptive title (2-4 words) following these rules:
        1. Use title case
        2. No ending punctuation
        3. Include key verbs/nouns
        4. Avoid generic terms like "Task" or "Work"
        
        Input: "{task_text}"
        Title:"""
        
        response = self._call_model(prompt, temperature=0.1).strip()
        
        # Validate and clean response
        clean_title = re.sub(r'^["\']?(.*?)["\']?$', r'\1', response)  # Remove quotes
        clean_title = re.sub(r'[^a-zA-Z0-9\s\-]', '', clean_title)     # Remove special chars
        clean_title = clean_title[:50].strip()
        
        # Fallback to intelligent truncation
        if len(clean_title.split()) < 2:
            words = re.findall(r'\b\w+\b', task_text)[:4]
            clean_title = ' '.join(words).title()
        
        return clean_title

    def _requires_research(self, task_text: str) -> bool:
        """Strict research requirement detection"""
        # Check for explicit resource requests
        if re.search(r'\b(sources?|references?|materials|resources?)\b', task_text, re.I):
            return True
        
        # Strict AI verification with negative examples
        prompt = f"""Should this task require EXTERNAL RESOURCES? Answer ONLY yes/no.
        Examples that need resources:
        - "Research vaccine efficacy studies"
        - "Find sources about climate change"
        
        Examples that DON'T need resources:
        - "Study for chemistry test" 
        - "Finish math homework"
        - "Create presentation"
        
        Task: {task_text}"""
        
        response = self._call_model(prompt, temperature=0.1).strip().lower()
        return response.startswith('yes')

    def _generate_research_sources(self, task_text: str) -> List[Dict]:
        """Generate quality research sources with validation"""
        system_prompt = """Generate 3 relevant, real-world research sources in STRICT JSON array format. Each source MUST have:
        - "title": string
        - "url": VALID URL string
        - "summary": string
        - "key_points": array of strings
        Example: [{"title": "...", "url": "https://real-site.com", "summary": "...", "key_points": ["..."]}]"""
        
        try:
            response = self._call_model(
                f"Generate research sources for: {task_text}",
                system_prompt,
                temperature=0.3  # Lower temperature for consistency
            )
            
            # Use JSON parser with comments
            parser = JsonComment()
            try:
                sources = parser.loads(response)
            except:
                # Fallback: Extract first JSON array
                sources = re.search(r'\[.*\]', response, re.DOTALL)
                if sources:
                    sources = parser.loads(sources.group(0))
            
            # Validate and sanitize URLs
            valid_sources = []
            for source in sources[:3]:
                if not isinstance(source, dict):
                    continue
                    
                # Sanitize URL
                url = source.get("url", "")
                if not url.startswith("http"):
                    url = f"https://scholar.google.com/search?q={urllib.parse.quote(source['title'])}"
                
                valid_sources.append({
                    "title": source.get("title", "Untitled Source").strip(),
                    "url": url,
                    "summary": source.get("summary", "").strip(),
                    "key_points": [kp.strip() for kp in source.get("key_points", []) if kp.strip()]
                })
                
            return valid_sources
            
        except Exception as e:
            logger.error(f"Research generation failed: {str(e)}\nResponse: {response}")
            return []

    def _enhanced_analysis(self, tasks: List[str], nodes: List[Dict]) -> Dict:
        """Robust critical path analysis with validation"""
        system_prompt = """Analyze task dependencies and return JSON with:
        - "dependencies": array of [task_index, depends_on_index]
        - "critical_path": array of task indexes
        Example: {"dependencies": [[0,1]], "critical_path": [0,1]}"""
        
        task_list = "\n".join([f"{i}: {task}" for i, task in enumerate(tasks)])
        prompt = f"""Analyze these tasks:
        {task_list}
        Return ONLY valid JSON with dependencies and critical path:"""
        
        response = self._call_model(prompt, system_prompt, temperature=0.1)
        
        # Parse JSON response
        try:
            analysis = json.loads(response)
        except json.JSONDecodeError:
            logger.error("Failed to parse analysis JSON")
            analysis = {"dependencies": [], "critical_path": []}

        # Process dependencies
        valid_deps = []
        for dep in analysis.get("dependencies", []):
            if len(dep) == 2 and isinstance(dep[0], int) and isinstance(dep[1], int):
                source = f"task_{dep[0]}"
                target = f"task_{dep[1]}"
                if source != target:
                    valid_deps.append([source, target])

        # Process critical path
        valid_cp = [f"task_{i}" for i in analysis.get("critical_path", range(len(tasks)))]

        return {
            "dependencies": valid_deps,
            "critical_path": valid_cp,
            "error": "AI analysis failed" if not valid_deps else None
        }

    def _parse_task_string(self, task_string: str) -> list:
        """Parse a string containing multiple tasks into a list of individual tasks."""
        if not task_string:
            return []
            
        # Normalize different bullet characters
        normalized = re.sub(r'^[•*]\s*', '- ', task_string, flags=re.MULTILINE)
        
        # Split tasks using more robust pattern
        task_entries = re.split(r'\n\s*-\s*', normalized)
        
        # Clean results
        return [entry.strip() for entry in task_entries if entry.strip()]

    def _parse_and_enhance_tasks(self, tasks_input) -> List[str]:
        """Parse and enhance tasks with AI correction"""
        raw_tasks = self._parse_task_string(tasks_input)
        
        # AI-powered task correction and enhancement
        enhanced_tasks = []
        for task in raw_tasks:
            parsed = self.parse_task(task)
            enhanced = self._enhance_task_description(parsed)
            enhanced_tasks.append(enhanced)
        
        return enhanced_tasks

    def _create_task_node(self, node_id: str, task: str) -> Dict:
        """Create a task node with AI-generated metadata"""
        parsed = self.parse_task(task)
        return {
            "id": node_id,
            "type": "task",
            "title": parsed.title,
            "label": parsed.title,
            "description": parsed.description,
            "priority": parsed.priority.value,
            "due_date": parsed.due_date.isoformat() if parsed.due_date else None,
            "estimated_time": parsed.estimated_time.total_seconds() if parsed.estimated_time else None,
            "tags": parsed.tags,
            "children": [],
            "metadata": {
                "raw_task": task,
                "ai_generated": True
            }
        }

    def _is_research_task(self, task: str) -> bool:
        """Determine if a task requires research"""
        prompt = f"""Does this task require research or information gathering? Answer only 'yes' or 'no'.
        Task: {task}"""
        response = self._call_model(prompt, temperature=0.1)
        return "yes" in response.lower()

    def _generate_research_children(self, parent_id: str, task: str) -> List[Dict]:
        """Generate research child nodes with citations"""
        system_prompt = """Generate 3-5 research sources for this task. For each source include:
        - title
        - url
        - key_points (3 bullet points)
        Format as JSON array with keys: title, url, key_points"""
        
        prompt = f"""Task: {task}
        Generate relevant research sources with actual citations."""
        
        try:
            response = self._call_model(prompt, system_prompt)
            sources = json.loads(response)
            
            children = []
            for i, source in enumerate(sources):
                children.append({
                    "id": f"{parent_id}_source_{i}",
                    "type": "source",
                    "parent": parent_id,
                    "title": source.get("title", "Untitled Source"),
                    "url": source.get("url", "#"),
                    "key_points": source.get("key_points", []),
                    "metadata": {
                        "ai_generated": True,
                        "verified": False
                    }
                })
            return children
        except Exception as e:
            logger.error(f"Failed to generate research sources: {str(e)}")
            return []

    def _create_fallback_analysis(self, tasks):
        """Create sequential dependencies with resource connections"""
        task_ids = [f"task_{i}" for i in range(len(tasks))]
        dependencies = []
        
        # Create sequential dependencies
        for i in range(len(tasks)-1):
            dependencies.append([task_ids[i], task_ids[i+1]])
        
        # Add resource connections
        for idx, node in enumerate(self.nodes):
            if node["type"] == "resource":
                parent_task = node.get("parent")
                if parent_task:
                    dependencies.append([parent_task, node["id"]])
        
        return {
            "dependencies": dependencies,
            "critical_path": task_ids
        }

    def _parse_task_string(self, task_string: str) -> list:
        """Parse a string containing multiple tasks into a list of individual tasks."""
        if not task_string:
            return []
            
        # Split by newlines
        lines = task_string.strip().split('\n')
        tasks = []
        current_task = ""
        
        for line in lines:
            line = line.strip()
            # Check if this line starts with a bullet point
            if re.match(r'^[-•*]', line):
                # If we have a current task in progress, add it to tasks
                if current_task:
                    tasks.append(current_task)
                # Start a new task, removing the bullet point
                current_task = re.sub(r'^[-•*]\s*', '', line)
            else:
                # If line doesn't start with bullet, it's a continuation of current task
                # Only append if there's actual content
                if line and current_task:
                    current_task += " " + line
        
        # Add the last task if there is one
        if current_task:
            tasks.append(current_task)
            
        return tasks

    def _get_task_analysis(self, tasks: List[str]) -> Dict:
        """Improved critical path analysis with validation"""
        system_prompt = """You are a task dependency analyzer. Your job is to determine 
        relationships between tasks.
        
        Return ONLY valid JSON with these fields:
        - dependencies: array of task INDEX PAIRS [[0,1], [1,2]] showing which tasks depend on others
        - critical_path: array of task INDEXES in execution order [0,1,2,3]
        
        DO NOT include any explanation, reasoning, or thinking. ONLY return JSON like:
        {"dependencies": [[0,1], [1,2]], "critical_path": [0,1,2,3]}
        """
        
        task_list = "\n".join([f"{i}. {task}" for i, task in enumerate(tasks)])
        prompt = f"Analyze dependencies between these tasks:\n{task_list}"
        
        # Use temperature 0.0 for maximum determinism
        response = self._call_model(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.0
        )
        
        logger.info(f"Raw response from model for task analysis: {response}")
        
        # Improved JSON extraction
        try:
            # First, try to remove any thinking or explanation
            # Look for patterns like <think>...</think>
            clean_response = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)
            if not clean_response.strip():
                clean_response = response
                
            # Try to extract any JSON-like structure with regex
            json_match = re.search(r'\{.*\}', clean_response, flags=re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                # Clean non-printable characters before parsing
                json_str = re.sub(r'[^\x20-\x7E]', '', json_str)
                # Parse the JSON
                try:
                    analysis = json.loads(json_str)
                except json.JSONDecodeError:
                    # If parsing fails, try to fix common JSON issues
                    json_str = re.sub(r"'", '"', json_str)  # Replace single quotes with double quotes
                    json_str = re.sub(r",\s*}", "}", json_str)  # Remove trailing commas
                    analysis = json.loads(json_str)
            else:
                raise ValueError("No JSON object found in response")
            
            # Validate structure
            if not isinstance(analysis, dict):
                raise ValueError("Response is not a dictionary")
                
            # Create default values if keys are missing
            if "dependencies" not in analysis:
                analysis["dependencies"] = []
            if "critical_path" not in analysis:
                analysis["critical_path"] = list(range(len(tasks)))
                
            # Process and validate dependencies
            max_index = len(tasks) - 1
            valid_deps = []
            for dep in analysis.get("dependencies", []):
                if isinstance(dep, list) and len(dep) == 2:
                    # Convert to integers
                    try:
                        idx1 = int(dep[0]) if isinstance(dep[0], str) else dep[0]
                        idx2 = int(dep[1]) if isinstance(dep[1], str) else dep[1]
                        if 0 <= idx1 <= max_index and 0 <= idx2 <= max_index and idx1 != idx2:
                            valid_deps.append([f"task_{idx1}", f"task_{idx2}"])
                    except (ValueError, TypeError):
                        # Skip invalid indices
                        continue
            
            # Process and validate critical path
            valid_cp = []
            for idx in analysis.get("critical_path", []):
                try:
                    idx_int = int(idx) if isinstance(idx, str) else idx
                    if 0 <= idx_int <= max_index:
                        valid_cp.append(f"task_{idx_int}")
                except (ValueError, TypeError):
                    # Skip invalid indices
                    continue
            
            # Ensure critical path isn't empty
            if not valid_cp:
                valid_cp = [f"task_{i}" for i in range(len(tasks))]
            
            return {
                "dependencies": valid_deps,
                "critical_path": valid_cp
            }
                    
        except Exception as e:
            logger.error(f"Critical path analysis failed: {str(e)}")
            # Create sensible defaults
            return self._create_fallback_analysis(tasks)

    def validate_json(response_text):
        try:
            return json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"Invalid JSON from AI: {e}")
            return None

    
    def suggest_silo(self, task: Task, available_silos: List[Silo]) -> str:
        """Suggest the most appropriate silo for a task."""
        if not available_silos:
            return ""
            
        # If there's only one silo, use that
        if len(available_silos) == 1:
            return available_silos[0].id
            
        # Prepare silo information
        silos_info = []
        for silo in available_silos:
            silos_info.append({
                "id": silo.id,
                "name": silo.name,
                "description": silo.description
            })
            
        system_prompt = """
        You are a task categorization system. Your job is to determine which silo (category) 
        a task belongs to based on its content and the available silos.
        Respond only with the ID of the most appropriate silo.
        """
        
        prompt = f"""
        Task: {task.title}
        Description: {task.description}
        Tags: {', '.join(task.tags)}
        
        Available silos:
        {json.dumps(silos_info, indent=2)}
        
        Which silo ID is most appropriate for this task?
        """
        
        response = self._call_model(prompt, system_prompt)
        
        # Try to extract a silo ID from the response
        silo_ids = [silo.id for silo in available_silos]
        for silo_id in silo_ids:
            if silo_id in response:
                return silo_id
                
        # If no exact match, use the first silo as default
        return available_silos[0].id
    
    def generate_subtasks(self, task: Task) -> List[Task]:
        """Generate subtasks for a complex task."""
        system_prompt = """
        Break down the given task into logical subtasks. For each subtask, provide:
        1. A clear, concise title
        2. A brief description
        3. Estimated time to complete (in hours or minutes)
        4. Dependencies on other subtasks (if any)
        
        Format your response as a JSON array of objects, each representing a subtask.
        """
        
        prompt = f"""
        Main task: {task.title}
        Description: {task.description}
        
        Generate 2-5 subtasks that would help complete this task efficiently.
        """
        
        response = self._call_model(prompt, system_prompt)
        
        # Try to extract JSON from the response
        try:
            json_start = response.find('[')
            json_end = response.rfind(']') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                subtasks_data = json.loads(json_str)
            else:
                # Try to find individual JSON objects if array not found
                json_start = response.find('{')
                json_end = response.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response[json_start:json_end]
                    subtasks_data = [json.loads(json_str)]
                else:
                    return []
        except Exception as e:
            logger.error(f"Error parsing subtasks JSON: {e}")
            return []
        
        subtasks = []
        for i, subtask_data in enumerate(subtasks_data):
            try:
                # Create subtask with parent_id set to the original task
                subtask = Task(
                    title=subtask_data.get("title", f"Subtask {i+1}"),
                    description=subtask_data.get("description", ""),
                    parent_id=task.id,
                    silo_id=task.silo_id,
                    ai_generated=True
                )
                
                # Parse estimated time if available
                est_time = subtask_data.get("estimated_time")
                if est_time:
                    # Try to convert to hours
                    if isinstance(est_time, (int, float)):
                        subtask.estimated_time = timedelta(hours=float(est_time))
                    elif isinstance(est_time, str):
                        hours_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:hour|hr|h)', est_time, re.IGNORECASE)
                        if hours_match:
                            hours = float(hours_match.group(1))
                            subtask.estimated_time = timedelta(hours=hours)
                        else:
                            minutes_match = re.search(r'(\d+)\s*(?:minute|min|m)', est_time, re.IGNORECASE)
                            if minutes_match:
                                minutes = int(minutes_match.group(1))
                                subtask.estimated_time = timedelta(minutes=minutes)
                
                subtasks.append(subtask)
            except Exception as e:
                logger.error(f"Error creating subtask: {e}")
                continue
        
        # Process dependencies between subtasks
        dependency_map = {}
        for i, subtask_data in enumerate(subtasks_data):
            if "dependencies" in subtask_data:
                deps = subtask_data["dependencies"]
                if isinstance(deps, list):
                    for dep in deps:
                        # Try to match dependency to a subtask title
                        for j, other_subtask in enumerate(subtasks):
                            if dep.lower() in other_subtask.title.lower() and i != j:
                                subtasks[i].add_dependency(other_subtask.id)
                                other_subtask.add_dependent(subtasks[i].id)
                                break
        
        return subtasks
    
    def estimate_completion_time(self, task: Task, user_history: Optional[List[Dict]] = None) -> timedelta:
        """Estimate time to complete a task based on its description and user history."""
        if task.estimated_time:
            return task.estimated_time
            
        system_prompt = """
        Estimate how long the described task will take to complete in hours and minutes.
        Respond with only a number followed by 'hours' or 'minutes'.
        """
        
        history_context = ""
        if user_history:
            completed_tasks = [t for t in user_history if t.get("status") == "completed"]
            if completed_tasks:
                history_context = "Based on similar completed tasks:\n"
                for t in completed_tasks[:5]:  # Use up to 5 similar tasks
                    history_context += f"- Task: {t.get('title')}, Actual time: {t.get('actual_time')}\n"
        
        prompt = f"""
        Task: {task.title}
        Description: {task.description}
        {history_context}
        
        How long will this task take to complete?
        """
        
        response = self._call_model(prompt, system_prompt)
        
        # Parse the response to extract hours or minutes
        hours_match = re.search(r'(\d+(?:\.\d+)?)\s*(?:hour|hr|h)', response, re.IGNORECASE)
        if hours_match:
            hours = float(hours_match.group(1))
            return timedelta(hours=hours)
            
        minutes_match = re.search(r'(\d+)\s*(?:minute|min|m)', response, re.IGNORECASE)
        if minutes_match:
            minutes = int(minutes_match.group(1))
            return timedelta(minutes=minutes)
            
        # Default to 1 hour if no valid time format is found
        return timedelta(hours=1)
    
    def prioritize_tasks(self, tasks: List[Task]) -> List[Task]:
        """Prioritize a list of tasks based on importance, urgency, and dependencies."""
        if not tasks:
            return []
            
        # Calculate a priority score for each task
        task_scores = []
        for task in tasks:
            score = 0
            
            # Priority factor
            priority_scores = {
                TaskPriority.LOW: 1,
                TaskPriority.MEDIUM: 2,
                TaskPriority.HIGH: 3,
                TaskPriority.URGENT: 4
            }
            score += priority_scores.get(task.priority, 2) * 10
            
            # Due date factor
            if task.due_date:
                days_until_due = (task.due_date - datetime.now()).days
                if days_until_due < 0:  # Overdue
                    score += 50
                elif days_until_due == 0:  # Due today
                    score += 40
                elif days_until_due <= 2:  # Due in next 2 days
                    score += 30
                elif days_until_due <= 7:  # Due in next week
                    score += 20
                else:
                    score += 10
            
            # Dependency factor
            # Tasks with no dependencies should be prioritized
            if not task.dependencies:
                score += 15
            
            # Tasks that are blocking many others should be prioritized
            score += len(task.dependents) * 5
            
            task_scores.append((task, score))
        
        # Sort by score in descending order
        sorted_tasks = [t for t, s in sorted(task_scores, key=lambda x: x[1], reverse=True)]
        return sorted_tasks
    
    def suggest_next_task(self, tasks: List[Task]) -> Optional[Task]:
        """Suggest the next task to work on from a list of tasks."""
        if not tasks:
            return None
            
        # Filter to non-completed, non-blocked tasks
        available_tasks = [t for t in tasks if t.status != TaskStatus.COMPLETED 
                           and t.status != TaskStatus.ARCHIVED]
        
        # Further filter to tasks that are not blocked by dependencies
        unblocked_tasks = []
        for task in available_tasks:
            is_blocked = False
            for dep_id in task.dependencies:
                # Find the dependency task
                dep_task = next((t for t in tasks if t.id == dep_id), None)
                if dep_task and dep_task.status != TaskStatus.COMPLETED:
                    is_blocked = True
                    break
            if not is_blocked:
                unblocked_tasks.append(task)
        
        if not unblocked_tasks:
            return None
            
        # Prioritize the unblocked tasks
        prioritized_tasks = self.prioritize_tasks(unblocked_tasks)
        return prioritized_tasks[0] if prioritized_tasks else None
    
    def analyze_task_completion(self, task: Task, completion_text: str) -> Tuple[bool, str]:
        """Analyze if a task is completed based on provided completion text."""
        system_prompt = """
        Analyze if the provided completion text indicates that the task has been fully completed.
        Respond with "YES" if the task is completed, "NO" if it is not, followed by a brief explanation.
        """
        
        prompt = f"""
        Task: {task.title}
        Description: {task.description}
        
        Completion text provided by user:
        "{completion_text}"
        
        Has this task been fully completed?
        """
        
        response = self._call_model(prompt, system_prompt)
        
        # Check if the response indicates completion
        is_completed = "YES" in response.upper().split()
        
        # Extract explanation
        explanation = response.replace("YES", "").replace("NO", "").strip()
        explanation = re.sub(r'^[,.:;-]\s*', '', explanation)  # Remove leading punctuation
        
        return is_completed, explanation